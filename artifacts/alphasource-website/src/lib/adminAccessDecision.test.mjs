import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
function compile(text, dependencies = {}, globals = {}, loader = "ts") {
  const module = { exports: {} };
  vm.runInNewContext(transformSync(text, { loader, format: "cjs", jsx: "automatic" }).code,
    { module, exports: module.exports, require: id => {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected module ${id}`);
      return dependencies[id];
    }, console: { warn() {} }, ...globals });
  return module.exports;
}
const decision = compile(source("./adminAccessDecision.ts"));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

// Executes the actual component's hooks with deterministic passive-effect
// ordering. This is not a browser/React DOM acceptance test.
function gateHarness() {
  let auth = { clientAuthReady: true, isLoggedIn: true, currentUser: { id: "admin-a" }, adminAccessEpoch: 1 };
  const hooks = [], requests = [], redirects = [], warnings = [];
  const draft = { marker: "unsent-enterprise-draft" };
  let index = 0, dirty = true, queue = [], output, mounted = true;
  const navigate = path => redirects.push(path);
  const resolver = () => { const request=deferred(); requests.push(request); return request.promise; };
  const react = {
    useState(initial) { const i=index++; if (!hooks[i]) hooks[i]={ value: initial }; return [hooks[i].value, value => {
      const next=typeof value==="function" ? value(hooks[i].value) : value;
      if (!Object.is(next,hooks[i].value)) { hooks[i].value=next; dirty=true; }
    }]; },
    useRef(initial) { const i=index++; if (!hooks[i]) hooks[i]={ current: initial }; return hooks[i]; },
    useEffect(fn,deps) { const i=index++, previous=hooks[i]; if (!previous || deps.some((x,n)=>!Object.is(x,previous.deps[n]))) {
      queue.push(()=>{ previous?.cleanup?.(); hooks[i]={ deps,cleanup:fn() }; });
    } },
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const Gate = compile(source("../components/AdminAccessGate.tsx"), {
    react, "react/jsx-runtime": { jsx, jsxs: jsx },
    wouter: { useLocation: () => ["/admin/billing",navigate] },
    "@/context/AuthContext": { useAuth: () => ({ ...auth, resolveAdminAccess:resolver }) },
    "@/lib/adminAccessDecision": decision,
  }, { console: { warn: message => warnings.push(message) } }, "tsx").default;
  const flush = () => {
    for (let turns=0;dirty && mounted;turns++) {
      assert.ok(turns<12,"guard must not loop"); dirty=false; index=0;
      output=Gate({ children:draft }); const effects=queue; queue=[]; effects.forEach(run=>run());
    }
    return output;
  };
  return { requests,redirects,warnings,draft,flush,
    update(values) { auth={...auth,...values}; dirty=true; return flush(); },
    unmount() { mounted=false; for (const hook of hooks) hook?.cleanup?.(); },
  };
}
async function allowedGate() { const h=gateHarness(); h.flush(); h.requests[0].resolve({status:"allowed",userId:"admin-a"}); await tick(); h.flush(); return h; }

test("same-user recheck keeps exact draft mounted and inert, without premature redirect",async()=>{
  const h=await allowedGate(),first=h.flush(); assert.equal(first.props.children,h.draft);
  const pending=h.update({adminAccessEpoch:2,isAdminLoggedIn:false,adminAuthReady:true});
  assert.equal(pending.props.children,h.draft); assert.equal(pending.key,first.key); assert.equal(pending.props.inert,true);
  assert.equal(h.redirects.length,0); assert.equal(h.requests.length,2);
  h.requests[1].resolve({status:"allowed",userId:"admin-a"}); await tick();
  assert.equal(h.flush().props.inert,false); assert.equal(h.redirects.length,0);
});
test("admin readiness/boolean flips do not launch another probe",async()=>{
  const h=await allowedGate(); h.update({adminAuthReady:false,isAdminLoggedIn:false}); h.update({adminAuthReady:true});
  assert.equal(h.requests.length,1); assert.equal(h.redirects.length,0);
});
test("superseded denied result cannot redirect or clear newer same-user check",async()=>{
  const h=await allowedGate(); h.update({adminAccessEpoch:2}); h.update({adminAccessEpoch:3});
  h.requests[1].resolve({status:"denied",userId:"admin-a"}); await tick();
  assert.equal(h.flush().props.inert,true); assert.equal(h.redirects.length,0);
  h.requests[2].resolve({status:"allowed",userId:"admin-a"}); await tick(); assert.equal(h.flush().props.inert,false);
});
test("latest actual denial unmounts and redirects once",async()=>{
  const h=await allowedGate(); h.update({adminAccessEpoch:2}); h.requests[1].resolve({status:"denied",userId:"admin-a"}); await tick();
  assert.equal(h.flush(),null); assert.deepEqual(h.redirects,["/"]); h.flush(); assert.equal(h.redirects.length,1);
});
test("missing session and logged-out direct visit never mount protected draft",()=>{
  const h=gateHarness(); assert.equal(h.update({isLoggedIn:false,currentUser:null}),null); assert.equal(h.requests.length,0);
  assert.deepEqual(h.redirects,["/"]);
});
test("changed user immediately hides old draft, ignores late allow and gets a fresh subtree key",async()=>{
  const h=await allowedGate(),oldKey=h.flush().key; h.update({adminAccessEpoch:2});
  assert.equal(h.update({currentUser:{id:"admin-b"},adminAccessEpoch:3}),null);
  h.requests[1].resolve({status:"allowed",userId:"admin-a"}); await tick(); assert.equal(h.flush(),null);
  h.requests[2].resolve({status:"allowed",userId:"admin-b"}); await tick(); assert.notEqual(h.flush().key,oldKey);
});
test("unmount during verification ignores late result",async()=>{
  const h=gateHarness(); h.flush(); h.unmount(); h.requests[0].resolve({status:"denied",userId:"admin-a"}); await tick();
  assert.equal(h.redirects.length,0);
});
test("stale result without a newer epoch remains inert and records one safe diagnostic",async()=>{
  const h=await allowedGate(); h.update({adminAccessEpoch:2}); h.requests[1].resolve({status:"stale",userId:"admin-a"}); await tick();
  assert.equal(h.flush().props.inert,true); assert.equal(h.redirects.length,0); assert.equal(h.requests.length,2);
  assert.deepEqual(h.warnings,["admin_access_verification_stale"]);
});

function probeHarness() {
  const auth=source("../context/AuthContext.tsx");
  const begin=auth.indexOf("  const resolveAdminAccess = useCallback"),end=auth.indexOf("\n\n  useEffect",begin);
  assert.ok(begin>=0 && end>begin);
  const sessionRead=deferred(),accessRead=deferred(),generation={current:0},writes=[];
  const globals={ useCallback:fn=>fn,adminProbeRef:generation,
    supabase:{auth:{getSession:()=>sessionRead.promise}},probeAdminAccess:()=>accessRead.promise,
    setIsAdminLoggedIn:value=>writes.push(["admin",value]),setAdminAuthReady:value=>writes.push(["ready",value]) };
  const probe=compile(auth.slice(begin,end)+"\nexport { resolveAdminAccess };",{},globals).resolveAdminAccess;
  return {probe,sessionRead,accessRead,generation,writes};
}
test("session invalidation during getSession returns stale without committing denial",async()=>{
  const h=probeHarness(),result=h.probe(); ++h.generation.current;
  h.sessionRead.resolve({data:{session:null},error:null}); assert.equal((await result).status,"stale"); assert.equal(h.writes.length,0);
});
test("superseded backend probe cannot commit a denial",async()=>{
  const h=probeHarness(),result=h.probe(); h.sessionRead.resolve({data:{session:{user:{id:"admin-a"},access_token:"synthetic"}},error:null});
  await tick(); ++h.generation.current; h.accessRead.resolve({ok:false}); assert.equal((await result).status,"stale");
  assert.equal(h.writes.filter(([key,value])=>key==="admin"&&value===false).length,0);
});
test("current-generation session error denies without bumping the generation twice",async()=>{
  const h=probeHarness(),result=h.probe(); h.sessionRead.reject(Error("synthetic failure")); assert.equal((await result).status,"denied");
  assert.equal(h.generation.current,1); assert.deepEqual(h.writes,[["admin",false],["ready",true]]);
});
test("current real backend denial and success remain distinct",async()=>{
  for (const ok of [false,true]) {const h=probeHarness(),result=h.probe();h.sessionRead.resolve({data:{session:{user:{id:"admin-a"}}},error:null});await tick();h.accessRead.resolve({ok});assert.equal((await result).status,ok?"allowed":"denied");}
});
test("forced stale-activity sign-out invalidates before awaiting local sign-out; guard wiring retains existing providers",()=>{
  const auth=source("../context/AuthContext.tsx"),app=source("../App.tsx");
  const initial=auth.slice(auth.indexOf("if (session && hasStaleDashboardActivity())"),auth.indexOf("if (session) {",auth.indexOf("if (session && hasStaleDashboardActivity())")));
  assert.ok(initial.indexOf("invalidateAdminAccess()")>=0 && initial.indexOf("invalidateAdminAccess()")<initial.indexOf("await supabase.auth.signOut"));
  assert.match(auth,/INITIAL_SESSION[\s\S]*?hasStaleDashboardActivity\(\)[\s\S]*?invalidateAdminAccess\(\)/);
  const guard=app.slice(app.indexOf("function AdminGuard()"),app.indexOf("function AdminRoleConfigRedirect()"));
  assert.match(guard,/<AdminAccessGate>[\s\S]*<AdminClientProvider>[\s\S]*<AdminBillingPage|<AdminAccessGate>[\s\S]*component=\{AdminBillingPage\}/);
  assert.ok(!guard.includes('setLocation("/")'));
});
