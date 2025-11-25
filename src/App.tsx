import { Routes, Route } from 'react-router-dom';
import RootLayout from '@/layouts/RootLayout';
import Home from '@/pages/Home';
import Protein from '@/pages/Protein';
import Creatine from '@/pages/Creatine';
import ProteinProduct from '@/pages/ProteinProduct';
import CreatineProduct from '@/pages/CreatineProduct';

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path='/' element={<Home />} />
        <Route path='/protein' element={<Protein />} />
        <Route path='/protein/:productSlug' element={<ProteinProduct />} />
        <Route path='/creatine' element={<Creatine />} />
        <Route path='/creatine/:productSlug' element={<CreatineProduct />} /> {/* 👈 new */}
      </Route>
    </Routes>
  );
}
