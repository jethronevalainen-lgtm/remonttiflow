import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import {
  Dashboard,
  Projektit,
  Asiakkaat,
  Henkilosto,
  Tyomaaraykset,
  Tuntikirjaukset,
  Kalusto,
  Laskenta,
  Maaralaskenta,
  Lomakkeet,
  Tyoturvallisuus,
  Viestinta,
  Raportit,
  Aikataulutus,
  Tyovuorokalenteri,
  Paivakirjat,
  Matkakulut,
  Jatehuolto,
  Tyonjohto,
  CRM,
  AI
} from './pages';
import StubPage from './pages/StubPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projektit" element={<Projektit />} />
          <Route path="/asiakkaat" element={<Asiakkaat />} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/henkilosto" element={<Henkilosto />} />
          <Route path="/tyomaaraykset" element={<Tyomaaraykset />} />
          <Route path="/tuntikirjaukset" element={<Tuntikirjaukset />} />
          <Route path="/tyovuorokalenteri" element={<Tyovuorokalenteri />} />
          <Route path="/kalusto" element={<Kalusto />} />
          <Route path="/laskenta" element={<Laskenta />} />
          <Route path="/maaralaskenta" element={<Maaralaskenta />} />
          <Route path="/lomakkeet" element={<Lomakkeet />} />
          <Route path="/tyoturvallisuus" element={<Tyoturvallisuus />} />
          <Route path="/viestinta" element={<Viestinta />} />
          <Route path="/raportit" element={<Raportit />} />
          <Route path="/aikataulutus" element={<Aikataulutus />} />
          <Route path="/paivakirjat" element={<Paivakirjat />} />
          <Route path="/matkakulut" element={<Matkakulut />} />
          <Route path="/jatehuolto" element={<Jatehuolto />} />
          <Route path="/tyonjohto" element={<Tyonjohto />} />
          <Route path="/ai" element={<AI />} />
          <Route path="*" element={<StubPage title="Sivua ei löydy" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
