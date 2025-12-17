import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaHome, FaFileAlt, FaClipboardList, FaChartBar, FaSignOutAlt, FaBars, FaTimes, FaMoon, FaSun, FaKey } from 'react-icons/fa';
import './Navbar.css';

const Navbar = () => {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = React.useState(false);
  const [temaOscuro, setTemaOscuro] = React.useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  React.useEffect(() => {
    if (temaOscuro) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [temaOscuro]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMenu = () => {
    setMenuAbierto(!menuAbierto);
  };

  const cerrarMenu = () => {
    setMenuAbierto(false);
  };

  const toggleTema = () => {
    setTemaOscuro(!temaOscuro);
  };

  if (!usuario) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={cerrarMenu}>
          <FaHome />
          <span>Licencias de Construcción</span>
        </Link>

        <button className="menu-toggle" onClick={toggleMenu} aria-label="Toggle menu">
          {menuAbierto ? <FaTimes /> : <FaBars />}
        </button>

        <ul className={`navbar-menu ${menuAbierto ? 'active' : ''}`}>
          <li className="navbar-item">
            <Link to="/" className="navbar-link" onClick={cerrarMenu}>
              <FaHome />
              <span>Inicio</span>
            </Link>
          </li>

          {usuario.rol === 'SOLICITANTE' && (
            <li className="navbar-item">
              <Link to="/nuevo-expediente" className="navbar-link" onClick={cerrarMenu}>
                <FaFileAlt />
                <span>Nueva Solicitud</span>
              </Link>
            </li>
          )}

          <li className="navbar-item">
            <Link to="/expedientes" className="navbar-link" onClick={cerrarMenu}>
              <FaClipboardList />
              <span>Expedientes</span>
            </Link>
          </li>

          {usuario.rol === 'INSPECTOR' && (
            <li className="navbar-item">
              <Link to="/inspecciones" className="navbar-link" onClick={cerrarMenu}>
                <FaClipboardList />
                <span>Inspecciones</span>
              </Link>
            </li>
          )}

          {(usuario.rol === 'ADMINISTRADOR' || usuario.rol === 'REVISOR_ADMINISTRATIVO' || usuario.rol === 'REVISOR_TECNICO') && (
            <li className="navbar-item">
              <Link to="/reportes" className="navbar-link" onClick={cerrarMenu}>
                <FaChartBar />
                <span>Reportes</span>
              </Link>
            </li>
          )}

          <li className="navbar-item">
            <button onClick={toggleTema} className="theme-toggle" aria-label="Cambiar tema">
              {temaOscuro ? <FaSun /> : <FaMoon />}
              <span>{temaOscuro ? 'Claro' : 'Oscuro'}</span>
            </button>
          </li>

          <li className="navbar-item">
            <Link to="/cambiar-contrasena" className="navbar-link" onClick={cerrarMenu}>
              <FaKey />
              <span>Cambiar Contraseña</span>
            </Link>
          </li>

          <li className="navbar-item navbar-user">
            <div className="user-info">
              <span className="user-name">{usuario.nombres} {usuario.apellidos}</span>
              <span className="user-role">{usuario.rol.replace('_', ' ')}</span>
            </div>
            <button onClick={handleLogout} className="btn-logout" aria-label="Cerrar sesión">
              <FaSignOutAlt />
              <span>Salir</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
