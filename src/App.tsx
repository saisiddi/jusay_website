import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import { AuthProvider } from "@/hooks/useAuth";

// The landing page (Index) loads eagerly since it's the entry point. Every
// other route is code-split so its JS is only fetched when visited, keeping
// the initial page load small and snappy.
const NotFound = lazy(() => import("./pages/NotFound"));
const About = lazy(() => import("./pages/About"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Contact = lazy(() => import("./pages/Contact"));
const AIMode = lazy(() => import("./pages/AIMode"));
const GrammarMode = lazy(() => import("./pages/GrammarMode"));
const NotesMode = lazy(() => import("./pages/NotesMode"));
const RewriteMode = lazy(() => import("./pages/RewriteMode"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Account = lazy(() => import("./pages/Account"));

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
          <Suspense fallback={null}>
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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
