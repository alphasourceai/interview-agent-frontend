import { useEffect, useState } from "react";
import { ShieldX } from "lucide-react";
import { Route, Switch } from "wouter";
import { AppearanceProvider } from "@/context/AppearanceContext";
import { useAuth } from "@/context/AuthContext";
import SalesLayout from "@/components/SalesLayout";
import { SalesApiError, salesApi, salesUsesMockApi } from "@/features/sales/salesApi";
import type { SalesRep } from "@/features/sales/types";
import SalesSignInPage from "@/pages/sales/SalesSignInPage";
import SalesDealsPage from "@/pages/sales/SalesDealsPage";
import SalesNewDealPage from "@/pages/sales/SalesNewDealPage";
import SalesEnterpriseHandoffPage from "@/pages/sales/SalesEnterpriseHandoffPage";
import SalesDealDetailPage from "@/pages/sales/SalesDealDetailPage";
import NotFound from "@/pages/not-found";

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F4F6FB]">
      <div className="flex items-center gap-3 text-sm font-black text-[#0A1547]/55">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#A380F6]/25 border-t-[#A380F6]" />
        Opening sales workspace…
      </div>
    </div>
  );
}

function AccessDenied({ message }: { message: string }) {
  const { logout } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center bg-[#F4F6FB] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#0A1547]/[0.07] bg-white p-7 text-center shadow-[0_20px_60px_rgba(10,21,71,0.09)]">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600"><ShieldX className="h-6 w-6" /></div>
        <h1 className="mt-4 text-xl font-black text-[#0A1547]">Sales access is not enabled</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#0A1547]/55">{message}</p>
        <button type="button" onClick={logout} className="mt-6 rounded-[10px] bg-[#0A1547] px-5 py-2.5 text-sm font-black text-white">Sign out</button>
      </div>
    </div>
  );
}

export default function SalesApp() {
  const { isLoggedIn, clientAuthReady, salesLoginLoading, logout } = useAuth();
  const [rep, setRep] = useState<SalesRep | null>(null);
  const [checking, setChecking] = useState(true);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    if (salesUsesMockApi || typeof window === "undefined") return;
    const handleInvalidSalesAuth = () => {
      setRep(null);
      setAccessError("");
      void logout();
    };
    window.addEventListener("alphasource:sales-auth-invalid", handleInvalidSalesAuth);
    return () => window.removeEventListener("alphasource:sales-auth-invalid", handleInvalidSalesAuth);
  }, [logout]);

  useEffect(() => {
    if ((!clientAuthReady || salesLoginLoading) && !salesUsesMockApi) return;
    if (!salesUsesMockApi && !isLoggedIn) {
      setRep(null);
      setChecking(false);
      setAccessError("");
      return;
    }
    let active = true;
    setChecking(true);
    setAccessError("");
    void salesApi.getMe()
      .then((nextRep) => {
        if (active) setRep(nextRep);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof SalesApiError && (error.status === 401 || error.status === 403)) {
          logout();
          setRep(null);
          setAccessError("");
          return;
        }
        const message = error instanceof Error ? error.message : "Sales access could not be verified.";
        setAccessError(message);
        setRep(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, [clientAuthReady, isLoggedIn, salesLoginLoading]);

  if (((!clientAuthReady || salesLoginLoading) && !salesUsesMockApi) || checking) return <LoadingScreen />;
  if (!salesUsesMockApi && !isLoggedIn) return <SalesSignInPage />;
  if (!rep) return <AccessDenied message={accessError || "Sales access could not be verified."} />;

  return (
    <AppearanceProvider>
      <SalesLayout rep={rep}>
        <Switch>
          <Route path="/sales/new" component={SalesNewDealPage} />
          <Route path="/sales/new/" component={SalesNewDealPage} />
          <Route path="/sales/enterprise" component={SalesEnterpriseHandoffPage} />
          <Route path="/sales/enterprise/" component={SalesEnterpriseHandoffPage} />
          <Route path="/sales/deals/:id" component={SalesDealDetailPage} />
          <Route path="/sales/deals/:id/" component={SalesDealDetailPage} />
          <Route path="/sales" component={SalesDealsPage} />
          <Route path="/sales/" component={SalesDealsPage} />
          <Route component={NotFound} />
        </Switch>
      </SalesLayout>
    </AppearanceProvider>
  );
}
