import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { FaFileAlt, FaClipboardList, FaCheckCircle, FaClock, FaExclamationTriangle } from 'react-icons/fa';
import { useQuery } from 'react-query';
import api from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const { usuario } = useAuth();

  const { data: expedientes, isLoading } = useQuery('expedientes', async () => {
    const response = await api.get('/expedientes?limit=5');
    return response.data.expedientes;
  });

  const { data: estadisticas } = useQuery(
    'estadisticas',
    async () => {
      if (usuario.rol === 'ADMINISTRADOR') {
        const response = await api.get('/reportes/estadisticas');
        return response.data;
      }
      return null;
    },
    { enabled: usuario.rol === 'ADMINISTRADOR' }
  );

  const getBadgeClass = (estado) => {
    const badgeMap = {
      'REGISTRADO': 'badge-info',
      'EN_REVISION_ADMINISTRATIVA': 'badge-warning',
      'EN_REVISION_TECNICA': 'badge-warning',
      'OBSERVADO': 'badge-danger',
      'PENDIENTE_PAGO': 'badge-warning',
      'PAGADO': 'badge-success',
      'APROBADO': 'badge-success',
      'LICENCIA_EMITIDA': 'badge-success',
      'RECHAZADO': 'badge-danger'
    };
    return badgeMap[estado] || 'badge-secondary';
  };

  return (
    <div className="container">
      <div className="dashboard-header">
        <h1>Bienvenido, {usuario.nombres}</h1>
        <p>Panel de control - {usuario.rol.replace('_', ' ')}</p>
      </div>

      {usuario.rol === 'SOLICITANTE' && (
        <div className="quick-actions">
          <h2>Acciones Rápidas</h2>
          <div className="grid grid-2">
            <Link to="/nuevo-expediente" className="action-card">
              <FaFileAlt className="action-icon" />
              <h3>Nueva Solicitud</h3>
              <p>Registrar una nueva solicitud de licencia de construcción</p>
            </Link>
            <Link to="/expedientes" className="action-card">
              <FaClipboardList className="action-icon" />
              <h3>Mis Expedientes</h3>
              <p>Ver el estado de tus solicitudes</p>
            </Link>
          </div>
        </div>
      )}

      {usuario.rol === 'ADMINISTRADOR' && estadisticas && (
        <div className="estadisticas-section">
          <h2>Estadísticas del Sistema</h2>
          <div className="grid grid-3">
            <div className="stat-card">
              <FaFileAlt className="stat-icon primary" />
              <div className="stat-content">
                <h3>{estadisticas.totalExpedientes}</h3>
                <p>Total Expedientes</p>
              </div>
            </div>
            <div className="stat-card">
              <FaCheckCircle className="stat-icon success" />
              <div className="stat-content">
                <h3>
                  {estadisticas.porEstado?.find(e => e._id === 'APROBADO')?.count || 0}
                </h3>
                <p>Aprobados</p>
              </div>
            </div>
            <div className="stat-card">
              <FaClock className="stat-icon warning" />
              <div className="stat-content">
                <h3>{Math.round(estadisticas.tiempoPromedioAprobacion)} días</h3>
                <p>Tiempo Promedio</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="expedientes-recientes">
        <div className="section-header">
          <h2>
            {usuario.rol === 'SOLICITANTE' ? 'Mis Expedientes Recientes' : 'Expedientes Recientes'}
          </h2>
          <Link to="/expedientes" className="btn btn-secondary">Ver Todos</Link>
        </div>

        {isLoading ? (
          <div className="spinner"></div>
        ) : expedientes && expedientes.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>N° Expediente</th>
                  <th>Proyecto</th>
                  <th>Solicitante</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {expedientes.map((exp) => (
                  <tr key={exp._id}>
                    <td>{exp.numeroExpediente}</td>
                    <td>{exp.proyecto.nombreProyecto}</td>
                    <td>{exp.solicitante.nombres} {exp.solicitante.apellidos}</td>
                    <td>
                      <span className={`badge ${getBadgeClass(exp.estado)}`}>
                        {exp.estado.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>{new Date(exp.fechaCreacion).toLocaleDateString()}</td>
                    <td>
                      <Link to={`/expediente/${exp._id}`} className="btn btn-primary btn-sm">
                        Ver Detalles
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <FaExclamationTriangle />
            <p>No hay expedientes para mostrar</p>
            {usuario.rol === 'SOLICITANTE' && (
              <Link to="/nuevo-expediente" className="btn btn-primary">
                Crear Nueva Solicitud
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
