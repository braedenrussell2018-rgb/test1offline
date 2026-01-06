import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppMenuBar } from "@/components/AppMenuBar";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Quotes from "./pages/Quotes";
import SoldItems from "./pages/SoldItems";
import Expenses from "./pages/Expenses";
import CRM from "./pages/CRM";
import Accounting from "./pages/Accounting";
import AIAssistant from "./pages/AIAssistant";
import ConversationAnalytics from "./pages/ConversationAnalytics";
import SpiffProgram from "./pages/SpiffProgram";
import SpiffAdmin from "./pages/SpiffAdmin";
import Auth from "./pages/Auth";
import Sync from "./pages/Sync";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import CustomerDashboard from "./pages/CustomerDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppMenuBar />
            <Routes>
              {/* Internal pages - owners and employees only */}
              <Route path="/" element={
                <RoleProtectedRoute allowedRoles={["owner", "employee"]} redirectTo="/spiff-program">
                  <Index />
                </RoleProtectedRoute>
              } />
              <Route path="/auth" element={<Auth />} />
              <Route path="/quotes" element={
                <RoleProtectedRoute allowedRoles={["owner", "employee"]} redirectTo="/spiff-program">
                  <Quotes />
                </RoleProtectedRoute>
              } />
              <Route path="/sold-items" element={
                <RoleProtectedRoute allowedRoles={["owner", "employee"]} redirectTo="/spiff-program">
                  <SoldItems />
                </RoleProtectedRoute>
              } />
              <Route path="/expenses" element={
                <RoleProtectedRoute allowedRoles={["owner", "employee"]} redirectTo="/spiff-program">
                  <Expenses />
                </RoleProtectedRoute>
              } />
              <Route path="/crm" element={
                <RoleProtectedRoute allowedRoles={["owner", "employee"]} redirectTo="/spiff-program">
                  <CRM />
                </RoleProtectedRoute>
              } />
              <Route path="/sync" element={
                <RoleProtectedRoute allowedRoles={["owner", "employee"]} redirectTo="/spiff-program">
                  <Sync />
                </RoleProtectedRoute>
              } />
              <Route path="/install" element={<Install />} />
              <Route path="/accounting" element={
                <RoleProtectedRoute allowedRoles={["owner", "employee"]} redirectTo="/spiff-program">
                  <Accounting />
                </RoleProtectedRoute>
              } />
              <Route path="/ai-assistant" element={
                <RoleProtectedRoute allowedRoles={["owner", "employee"]} redirectTo="/spiff-program">
                  <AIAssistant />
                </RoleProtectedRoute>
              } />
              <Route path="/analytics" element={
                <RoleProtectedRoute allowedRoles={["owner", "employee"]} redirectTo="/spiff-program">
                  <ConversationAnalytics />
                </RoleProtectedRoute>
              } />
              {/* Spiff Program - salesmen, owners, and employees can view */}
              <Route path="/spiff-program" element={
                <RoleProtectedRoute allowedRoles={["salesman", "owner", "employee"]} redirectTo="/">
                  <SpiffProgram />
                </RoleProtectedRoute>
              } />
              {/* Spiff Admin - owners only */}
              <Route path="/spiff-admin" element={
                <RoleProtectedRoute allowedRoles={["owner"]} redirectTo="/">
                  <SpiffAdmin />
                </RoleProtectedRoute>
              } />
              {/* Customer dashboard */}
              <Route path="/customer" element={
                <RoleProtectedRoute allowedRoles={["customer"]} redirectTo="/">
                  <CustomerDashboard />
                </RoleProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
