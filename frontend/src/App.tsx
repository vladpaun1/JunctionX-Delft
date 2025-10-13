import { Routes, Route, Navigate } from 'react-router-dom'
import UploadPage from './components/UploadPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
