import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppMenuBar } from "@/components/AppMenuBar";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Quotes from "./pages/Quotes";
import SoldItems from "./pages/SoldItems";
import Expenses from "./pages/Expenses";
import CRM from "./pages/CRM";
import Accounting from "./pages/Accounting";
import Auth from "./pages/Auth";
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
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
            <Route path="/sold-items" element={<ProtectedRoute><SoldItems /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
            <Route path="/accounting" element={<ProtectedRoute><Accounting /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
