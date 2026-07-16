import { Toaster } from "react-hot-toast";
import AppRoutes from "./routes";
import { ThemeProvider } from "./components/ThemeProvider";

function App() {

  return (
    <ThemeProvider>
      <Toaster position="top-right" />

      <AppRoutes />
    </ThemeProvider>
  );
}

export default App;