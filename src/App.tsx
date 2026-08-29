import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import AIMode from "./pages/AIMode";
import GrammarMode from "./pages/GrammarMode";
import NotesMode from "./pages/NotesMode";
import RewriteMode from "./pages/RewriteMode";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Account from "./pages/Account";
import { AuthProvider } from "@/hooks/useAuth";

const queryClient = new QueryClient();

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/modes/ai" element={<AIMode />} />
            <Route path="/modes/grammar" element={<GrammarMode />} />
            <Route path="/modes/notes" element={<NotesMode />} />
            <Route path="/modes/rewrite" element={<RewriteMode />} />

            {/* Auth + billing (web). The desktop OAuth hand-off lives at the
                static /auth/callback/ page and is intentionally not a SPA route. */}
            <Route path="/login" element={<Login />} />
            <Route path="/auth/web-callback" element={<AuthCallback />} />
            <Route path="/account" element={<Account />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
