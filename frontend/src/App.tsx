import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { ClientesPage } from './pages/ClientesPage';
import { NovoClientePage } from './pages/NovoClientePage';
import { ClienteDetalhePage } from './pages/ClienteDetalhePage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/clientes"
            element={
              <RequireAuth>
                <ClientesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/clientes/novo"
            element={
              <RequireAuth>
                <NovoClientePage />
              </RequireAuth>
            }
          />
          <Route
            path="/clientes/:id"
            element={
              <RequireAuth>
                <ClienteDetalhePage />
              </RequireAuth>
            }
          />
          <Route path="/" element={<Navigate to="/clientes" replace />} />
          <Route path="*" element={<Navigate to="/clientes" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
