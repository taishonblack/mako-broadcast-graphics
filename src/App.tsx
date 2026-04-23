import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import ProjectLauncher from "./pages/ProjectLauncher";
import Blocks from "./pages/Blocks";
import PollCreate from "./pages/PollCreate";
import BackgroundGallery from "./pages/BackgroundGallery";
import ProgramOutput from "./pages/ProgramOutput";
import ViewerVote from "./pages/ViewerVote";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const LegacyGraphicsRedirect = () => {
  const { id } = useParams<{ id: string }>();

  return <Navigate to={id ? `/polls/${id}?mode=build` : "/polls/new?mode=build"} replace />;
};

const LegacyPollEditRedirect = () => {
  const { id } = useParams<{ id: string }>();

  return <Navigate to={id ? `/polls/${id}?mode=build` : "/polls/new?mode=build"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/projects" element={<ProjectLauncher />} />
          <Route path="/dashboard" element={<Navigate to="/polls/new?mode=output" replace />} />
          <Route path="/blocks" element={<ProtectedRoute><Blocks /></ProtectedRoute>} />
          <Route path="/backgrounds" element={<ProtectedRoute><BackgroundGallery /></ProtectedRoute>} />
          <Route path="/polls/new" element={<ProtectedRoute><PollCreate /></ProtectedRoute>} />
          <Route path="/polls/:id" element={<ProtectedRoute><PollCreate /></ProtectedRoute>} />
          <Route path="/polls/:id/edit" element={<ProtectedRoute><LegacyPollEditRedirect /></ProtectedRoute>} />
          <Route path="/graphics/:id" element={<LegacyGraphicsRedirect />} />
          <Route path="/output/:id" element={<ProgramOutput />} />
          <Route path="/vote/:slug" element={<ViewerVote />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
