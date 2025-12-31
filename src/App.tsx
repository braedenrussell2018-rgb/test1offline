import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppMenuBar } from "@/components/AppMenuBar";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppMenuBar />
          <Routes>
            <Route path="/" element={
              <RoleProtectedRoute allowedRoles={["owner", "employee"]} redirectTo="/spiff-program">
                <Index />
              </RoleProtectedRoute>
            } />
            <Route path="/auth" element={<Auth />} />
            <Route path="/quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
            <Route path="/sold-items" element={<ProtectedRoute><SoldItems /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
            <Route path="/sync" element={<ProtectedRoute><Sync /></ProtectedRoute>} />
            <Route path="/install" element={<Install />} />
            <Route path="/accounting" element={<ProtectedRoute><Accounting /></ProtectedRoute>} />
            <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><ConversationAnalytics /></ProtectedRoute>} />
            {/* Spiff Program - salesmen only */}
            <Route path="/spiff-program" element={
              <RoleProtectedRoute allowedRoles={["salesman"]} redirectTo="/auth">
                <SpiffProgram />
              </RoleProtectedRoute>
            } />
            {/* Spiff Admin - owners only */}
            <Route path="/spiff-admin" element={
              <RoleProtectedRoute allowedRoles={["owner"]} redirectTo="/">
                <SpiffAdmin />
              </RoleProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
