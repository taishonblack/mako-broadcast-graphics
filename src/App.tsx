import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import ProjectLauncher from "./pages/ProjectLauncher";
import Dashboard from "./pages/Dashboard";
import Blocks from "./pages/Blocks";
import PollCreate from "./pages/PollCreate";
import BackgroundGallery from "./pages/BackgroundGallery";
import GraphicsEditor from "./pages/GraphicsEditor";
import ProgramOutput from "./pages/ProgramOutput";
import ViewerVote from "./pages/ViewerVote";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/projects" element={<ProjectLauncher />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/blocks" element={<ProtectedRoute><Blocks /></ProtectedRoute>} />
          <Route path="/backgrounds" element={<ProtectedRoute><BackgroundGallery /></ProtectedRoute>} />
          <Route path="/polls/new" element={<ProtectedRoute><PollCreate /></ProtectedRoute>} />
          <Route path="/polls/:id" element={<ProtectedRoute><PollCreate /></ProtectedRoute>} />
          <Route path="/polls/:id/edit" element={<ProtectedRoute><PollCreate /></ProtectedRoute>} />
          <Route path="/graphics/:id" element={<GraphicsEditor />} />
          <Route path="/output/:id" element={<ProgramOutput />} />
          <Route path="/vote/:slug" element={<ViewerVote />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
