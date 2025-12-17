import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../services/api';
import { FaFileAlt, FaHistory, FaMoneyBillWave, FaFilePdf, FaDownload, FaUpload, FaCheckCircle, FaEnvelope } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import EnviarMensaje from '../components/EnviarMensaje';
import './Pages.css';

const DetalleExpediente = () => {
  const { id } = useParams();
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [voucherFile, setVoucherFile] = useState(null);
  const [subiendoVoucher, setSubiendoVoucher] = useState(false);
  const [datosVoucher, setDatosVoucher] = useState({
    numeroOperacion: '',
    fechaPago: ''
  });
  const [montoAsignar, setMontoAsignar] = useState('');
  const [asignandoMonto, setAsignandoMonto] = useState(false);
  const [mostrarModalMensaje, setMostrarModalMensaje] = useState(false);
  const [licenciaFile, setLicenciaFile] = useState(null);
  const [subiendoLicencia, setSubiendoLicencia] = useState(false);

  const { data: expediente, isLoading } = useQuery(['expediente', id], async () => {
    const response = await api.get(`/expedientes/${id}`);
    return response.data;
  });

  const handleVoucherChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de archivo (imagen o PDF)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Solo se permiten imágenes (JPG, PNG) o PDF');
        e.target.value = '';
        return;
      }
      // Validar tamaño (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El archivo no debe superar los 5MB');
        e.target.value = '';
        return;
      }
      setVoucherFile(file);
    }
  };

  const subirVoucher = async () => {
    if (!voucherFile) {
      toast.error('Por favor seleccione la imagen o PDF del voucher');
      return;
    }

    if (!datosVoucher.numeroOperacion || !datosVoucher.fechaPago) {
      toast.error('Complete el número de operación y la fecha de pago');
      return;
    }

    setSubiendoVoucher(true);
    try {
      const formData = new FormData();
      formData.append('voucher', voucherFile);
      formData.append('numeroOperacion', datosVoucher.numeroOperacion);
      formData.append('fechaPago', datosVoucher.fechaPago);

      await api.post(`/expedientes/${id}/voucher`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Voucher de pago registrado exitosamente');
      setVoucherFile(null);
      setDatosVoucher({ numeroOperacion: '', fechaPago: '' });
      queryClient.invalidateQueries(['expediente', id]);
    } catch (error) {
      console.error('Error al subir voucher:', error);
      toast.error(error.response?.data?.error || 'Error al subir voucher');
    } finally {
      setSubiendoVoucher(false);
    }
  };

  const asignarMonto = async () => {
    if (!montoAsignar || parseFloat(montoAsignar) <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    setAsignandoMonto(true);
    try {
      await api.put(`/expedientes/${id}/pago`, {
        monto: parseFloat(montoAsignar)
      });

      toast.success('Monto de pago asignado correctamente');
      setMontoAsignar('');
      queryClient.invalidateQueries(['expediente', id]);
    } catch (error) {
      console.error('Error al asignar monto:', error);
      toast.error(error.response?.data?.error || 'Error al asignar monto');
    } finally {
      setAsignandoMonto(false);
    }
  };

  const descargarDocumento = (ruta, nombre) => {
    if (!ruta) {
      toast.error('Documento no disponible');
      return;
    }
    // Abrir en nueva pestaña para descargar
    window.open(`http://localhost:5000/${ruta}`, '_blank');
  };

  const handleLicenciaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de archivo (solo PDF)
      if (file.type !== 'application/pdf') {
        toast.error('Solo se permiten archivos PDF');
        e.target.value = '';
        return;
      }
      // Validar tamaño (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('El archivo no debe superar los 10MB');
        e.target.value = '';
        return;
      }
      setLicenciaFile(file);
    }
  };

  const subirLicencia = async () => {
    if (!licenciaFile) {
      toast.error('Por favor seleccione el archivo PDF de la licencia');
      return;
    }

    if (!window.confirm('¿Está seguro de subir esta licencia? Se enviará automáticamente al usuario por correo electrónico.')) {
      return;
    }

    setSubiendoLicencia(true);

    try {
      const formData = new FormData();
      formData.append('licencia', licenciaFile);

      await api.post(`/expedientes/${id}/subir-licencia`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('¡Licencia subida y enviada al usuario exitosamente!');
      toast.info('El usuario recibirá la licencia en su correo electrónico');
      setLicenciaFile(null);
      
      // Limpiar el input file
      const fileInput = document.getElementById('licencia-file');
      if (fileInput) fileInput.value = '';
      
      queryClient.invalidateQueries(['expediente', id]);
    } catch (error) {
      console.error('Error al subir licencia:', error);
      toast.error(error.response?.data?.error || 'Error al subir la licencia');
    } finally {
      setSubiendoLicencia(false);
    }
  };

  const descargarLicencia = () => {
    window.open(`http://localhost:5000/api/expedientes/${id}/descargar-licencia`, '_blank');
  };

  if (isLoading) return <div className="spinner"></div>;
  if (!expediente) return <div>Expediente no encontrado</div>;

  const getBadgeClass = (estado) => {
    const badgeMap = {
      'PENDIENTE': 'badge-warning',
      'APROBADO': 'badge-success',
      'RECHAZADO': 'badge-danger',
      'OBSERVADO': 'badge-warning'
    };
    return badgeMap[estado] || 'badge-secondary';
  };

  return (
    <div className="container">
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1>{expediente.numeroExpediente}</h1>
            <span className={`badge ${getBadgeClass(expediente.estado)}`}>
              {expediente.estado.replace(/_/g, ' ')}
            </span>
          </div>
          
          {usuario && usuario.rol === 'ADMINISTRADOR' && (
            <button 
              onClick={() => setMostrarModalMensaje(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FaEnvelope /> Enviar Mensaje al Usuario
            </button>
          )}
        </div>
      </div>

      {/* Alerta de pago pendiente */}
      {usuario && usuario.rol === 'SOLICITANTE' && expediente.pago && !expediente.pago.comprobante && (
        <div style={{padding: '16px', backgroundColor: '#fff3e0', border: '2px solid #ff9800', borderRadius: '8px', marginBottom: '20px'}}>
          <h3 style={{margin: '0 0 8px 0', color: '#f57c00', fontSize: '18px'}}>
            ⚠️ Acción Requerida: Registrar Pago
          </h3>
          <p style={{margin: '0 0 12px 0', fontSize: '14px'}}>
            Para continuar con el trámite, debe realizar el pago de la licencia en el <strong>Banco de la Nación</strong> y adjuntar el voucher en la sección de "Información de Pago" más abajo.
          </p>
          <p style={{margin: 0, fontSize: '13px', color: '#666'}}>
            Recuerde tener a mano: número de operación, fecha de pago y foto/PDF del voucher.
          </p>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Datos del Solicitante</h2>
          </div>
          <div className="card-body">
            <p><strong>Nombre:</strong> {expediente.solicitante.nombres} {expediente.solicitante.apellidos}</p>
            <p><strong>DNI:</strong> {expediente.solicitante.dni}</p>
            <p><strong>Email:</strong> {expediente.solicitante.email}</p>
            <p><strong>Teléfono:</strong> {expediente.solicitante.telefono}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Datos del Proyecto</h2>
          </div>
          <div className="card-body">
            <p><strong>Proyecto:</strong> {expediente.proyecto.nombreProyecto}</p>
            <p><strong>Dirección:</strong> {expediente.proyecto.direccionProyecto}</p>
            <p><strong>Distrito:</strong> {expediente.proyecto.distrito}</p>
            <p><strong>Área Terreno:</strong> {expediente.proyecto.areaTerreno} m²</p>
            <p><strong>Área Construcción:</strong> {expediente.proyecto.areaConstruccion} m²</p>
          </div>
        </div>
      </div>

      {/* Documentos Administrativos */}
      {expediente.documentos && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><FaFilePdf /> Documentación Administrativa</h2>
          </div>
          <div className="card-body">
            {!expediente.documentos.formularioUnico && !expediente.documentos.certificadoLiteral && 
             !expediente.documentos.declaracionJurada && !expediente.documentos.documentoDerecho && 
             !expediente.documentos.vigenciaPoder && !expediente.documentos.licenciaAnterior ? (
              <p className="text-center" style={{color: '#999'}}>No se han adjuntado documentos administrativos</p>
            ) : (
              <div className="grid grid-2">
                {/* Formulario Único de Edificación */}
                {expediente.documentos.formularioUnico && (
                  <div className="document-item">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong><FaFilePdf style={{color: '#d32f2f'}} /> Formulario Único de Edificación (FUE)</strong>
                        <p style={{fontSize: '12px', color: '#666', margin: '4px 0'}}>
                          {expediente.documentos.formularioUnico.nombre}
                        </p>
                        <small style={{color: '#999'}}>
                          {new Date(expediente.documentos.formularioUnico.fechaCarga).toLocaleDateString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => descargarDocumento(expediente.documentos.formularioUnico.ruta, expediente.documentos.formularioUnico.nombre)}
                      >
                        <FaDownload /> Ver
                      </button>
                    </div>
                  </div>
                )}

                {/* Certificado Literal */}
                {expediente.documentos.certificadoLiteral && (
                  <div className="document-item">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong><FaFilePdf style={{color: '#d32f2f'}} /> Certificado Literal Actualizado</strong>
                        <p style={{fontSize: '12px', color: '#666', margin: '4px 0'}}>
                          {expediente.documentos.certificadoLiteral.nombre}
                        </p>
                        <small style={{color: '#999'}}>
                          Cargado: {new Date(expediente.documentos.certificadoLiteral.fechaCarga).toLocaleDateString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => descargarDocumento(expediente.documentos.certificadoLiteral.ruta, expediente.documentos.certificadoLiteral.nombre)}
                      >
                        <FaDownload /> Ver
                      </button>
                    </div>
                  </div>
                )}

                {/* Declaración Jurada */}
                {expediente.documentos.declaracionJurada && (
                  <div className="document-item">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong><FaFilePdf style={{color: '#d32f2f'}} /> Declaración Jurada de Profesionales</strong>
                        <p style={{fontSize: '12px', color: '#666', margin: '4px 0'}}>
                          {expediente.documentos.declaracionJurada.nombre}
                        </p>
                        <small style={{color: '#999'}}>
                          {new Date(expediente.documentos.declaracionJurada.fechaCarga).toLocaleDateString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => descargarDocumento(expediente.documentos.declaracionJurada.ruta, expediente.documentos.declaracionJurada.nombre)}
                      >
                        <FaDownload /> Ver
                      </button>
                    </div>
                  </div>
                )}

                {/* Documento Derecho a Edificar */}
                {expediente.documentos.documentoDerecho && (
                  <div className="document-item">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong><FaFilePdf style={{color: '#d32f2f'}} /> Derecho a Edificar</strong>
                        <p style={{fontSize: '12px', color: '#666', margin: '4px 0'}}>
                          {expediente.documentos.documentoDerecho.nombre}
                        </p>
                        <small style={{color: '#999'}}>
                          Escritura pública o certificado de vigencia de poder
                        </small>
                        <br />
                        <small style={{color: '#999'}}>
                          {new Date(expediente.documentos.documentoDerecho.fechaCarga).toLocaleDateString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => descargarDocumento(expediente.documentos.documentoDerecho.ruta, expediente.documentos.documentoDerecho.nombre)}
                      >
                        <FaDownload /> Ver
                      </button>
                    </div>
                  </div>
                )}

                {/* Vigencia de Poder */}
                {expediente.documentos.vigenciaPoder && (
                  <div className="document-item">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong><FaFilePdf style={{color: '#d32f2f'}} /> Vigencia de Poder (Persona Jurídica)</strong>
                        <p style={{fontSize: '12px', color: '#666', margin: '4px 0'}}>
                          {expediente.documentos.vigenciaPoder.nombre}
                        </p>
                        <small style={{color: '#999'}}>
                          Con datos de partida registral y asiento inscrito
                        </small>
                        <br />
                        <small style={{color: '#999'}}>
                          {new Date(expediente.documentos.vigenciaPoder.fechaCarga).toLocaleDateString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => descargarDocumento(expediente.documentos.vigenciaPoder.ruta, expediente.documentos.vigenciaPoder.nombre)}
                      >
                        <FaDownload /> Ver
                      </button>
                    </div>
                  </div>
                )}

                {/* Licencia de Edificación Anterior */}
                {expediente.documentos.licenciaAnterior && (
                  <div className="document-item">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong><FaFilePdf style={{color: '#d32f2f'}} /> Licencia de Edificación Anterior</strong>
                        <p style={{fontSize: '12px', color: '#666', margin: '4px 0'}}>
                          {expediente.documentos.licenciaAnterior.nombre}
                        </p>
                        <small style={{color: '#999'}}>
                          Para remodelaciones y ampliaciones
                        </small>
                        <br />
                        <small style={{color: '#999'}}>
                          {new Date(expediente.documentos.licenciaAnterior.fechaCarga).toLocaleDateString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => descargarDocumento(expediente.documentos.licenciaAnterior.ruta, expediente.documentos.licenciaAnterior.nombre)}
                      >
                        <FaDownload /> Ver
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documentación Técnica */}
      {expediente.documentos && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><FaUpload /> Documentación Técnica</h2>
          </div>
          <div className="card-body">
            {!expediente.documentos.planoUbicacion && !expediente.documentos.planosArquitectura && 
             !expediente.documentos.planosEspecialidades && !expediente.documentos.planoSenalizacion && 
             !expediente.documentos.cartaSeguridad ? (
              <p className="text-center" style={{color: '#999'}}>No se han adjuntado documentos técnicos</p>
            ) : (
              <div className="grid grid-2">
                {/* Plano de Ubicación */}
                {expediente.documentos.planoUbicacion && (
                  <div className="document-item">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong><FaFilePdf style={{color: '#d32f2f'}} /> Plano de Ubicación y Localización</strong>
                        <p style={{fontSize: '12px', color: '#666', margin: '4px 0'}}>
                          {expediente.documentos.planoUbicacion.nombre}
                        </p>
                        <small style={{color: '#999'}}>
                          Con información del certificado de parámetros urbanos
                        </small>
                        <br />
                        <small style={{color: '#999'}}>
                          {new Date(expediente.documentos.planoUbicacion.fechaCarga).toLocaleDateString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => descargarDocumento(expediente.documentos.planoUbicacion.ruta, expediente.documentos.planoUbicacion.nombre)}
                      >
                        <FaDownload /> Ver
                      </button>
                    </div>
                  </div>
                )}

                {/* Planos de Arquitectura */}
                {expediente.documentos.planosArquitectura && (
                  <div className="document-item">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong><FaFilePdf style={{color: '#d32f2f'}} /> Planos de Arquitectura</strong>
                        <p style={{fontSize: '12px', color: '#666', margin: '4px 0'}}>
                          {expediente.documentos.planosArquitectura.nombre}
                        </p>
                        <small style={{color: '#999'}}>
                          Planta, cortes y elevaciones con memorias descriptivas
                        </small>
                        <br />
                        <small style={{color: '#999'}}>
                          {new Date(expediente.documentos.planosArquitectura.fechaCarga).toLocaleDateString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => descargarDocumento(expediente.documentos.planosArquitectura.ruta, expediente.documentos.planosArquitectura.nombre)}
                      >
                        <FaDownload /> Ver
                      </button>
                    </div>
                  </div>
                )}

                {/* Planos de Especialidades */}
                {expediente.documentos.planosEspecialidades && (
                  <div className="document-item">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong><FaFilePdf style={{color: '#d32f2f'}} /> Planos de Especialidades</strong>
                        <p style={{fontSize: '12px', color: '#666', margin: '4px 0'}}>
                          {expediente.documentos.planosEspecialidades.nombre}
                        </p>
                        <small style={{color: '#999'}}>
                          Estructuras, instalaciones sanitarias e instalaciones eléctricas con memorias
                        </small>
                        <br />
                        <small style={{color: '#999'}}>
                          {new Date(expediente.documentos.planosEspecialidades.fechaCarga).toLocaleDateString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => descargarDocumento(expediente.documentos.planosEspecialidades.ruta, expediente.documentos.planosEspecialidades.nombre)}
                      >
                        <FaDownload /> Ver
                      </button>
                    </div>
                  </div>
                )}

                {/* Plano de Señalización */}
                {expediente.documentos.planoSenalizacion && (
                  <div className="document-item">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong><FaFilePdf style={{color: '#d32f2f'}} /> Plano de Señalización y Evacuación</strong>
                        <p style={{fontSize: '12px', color: '#666', margin: '4px 0'}}>
                          {expediente.documentos.planoSenalizacion.nombre}
                        </p>
                        <small style={{color: '#999'}}>
                          {new Date(expediente.documentos.planoSenalizacion.fechaCarga).toLocaleDateString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => descargarDocumento(expediente.documentos.planoSenalizacion.ruta, expediente.documentos.planoSenalizacion.nombre)}
                      >
                        <FaDownload /> Ver
                      </button>
                    </div>
                  </div>
                )}

                {/* Carta de Seguridad (Demoliciones) */}
                {expediente.documentos.cartaSeguridad && (
                  <div className="document-item">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong><FaFilePdf style={{color: '#d32f2f'}} /> Carta de Seguridad de Obra (XV)</strong>
                        <p style={{fontSize: '12px', color: '#666', margin: '4px 0'}}>
                          {expediente.documentos.cartaSeguridad.nombre}
                        </p>
                        <small style={{color: '#999'}}>
                          Para demoliciones totales
                        </small>
                        <br />
                        <small style={{color: '#999'}}>
                          {new Date(expediente.documentos.cartaSeguridad.fechaCarga).toLocaleDateString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => descargarDocumento(expediente.documentos.cartaSeguridad.ruta, expediente.documentos.cartaSeguridad.nombre)}
                      >
                        <FaDownload /> Ver
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><FaMoneyBillWave /> Información de Pago - Banco de la Nación</h2>
        </div>
        <div className="card-body">
          {expediente.pago && expediente.pago.monto ? (
            <>
              <div className="grid grid-2" style={{marginBottom: '16px'}}>
                <div>
                  <p><strong>Monto a Pagar:</strong></p>
                  <p style={{fontSize: '24px', color: '#1976d2', fontWeight: 'bold', margin: '4px 0'}}>
                    S/ {expediente.pago.monto.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p><strong>Estado del Pago:</strong></p>
                  <p><span className={`badge ${getBadgeClass(expediente.pago.estado)}`} style={{fontSize: '14px', padding: '8px 16px'}}>
                    {expediente.pago.estado}
                  </span></p>
                </div>
              </div>
              {expediente.pago.fechaPago && (
                <p><strong>Fecha de Registro:</strong> {new Date(expediente.pago.fechaPago).toLocaleDateString()}</p>
              )}
              
              {/* Mostrar voucher si existe */}
              {expediente.pago.comprobante && (
                <div style={{marginTop: '16px', padding: '16px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '1px solid #4caf50'}}>
                  <p style={{fontWeight: 'bold', marginBottom: '12px'}}>
                    <FaCheckCircle style={{color: 'green', marginRight: '8px'}} />
                    Comprobante de Pago Registrado
                  </p>
                  <div className="grid grid-2" style={{gap: '12px', marginBottom: '12px'}}>
                    <div>
                      <strong>Número de Operación:</strong>
                      <p style={{margin: '4px 0', fontSize: '16px', color: '#1976d2'}}>
                        {expediente.pago.numeroOperacion || 'No especificado'}
                      </p>
                    </div>
                    <div>
                      <strong>Fecha de Operación:</strong>
                      <p style={{margin: '4px 0'}}>
                        {expediente.pago.fechaOperacion ? new Date(expediente.pago.fechaOperacion).toLocaleDateString() : 'No especificada'}
                      </p>
                    </div>
                  </div>
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => descargarDocumento(expediente.pago.comprobante, 'voucher-pago')}
                  >
                    <FaDownload /> Ver Voucher del Banco de la Nación
                  </button>
                </div>
              )}

              {/* Botón para mostrar formulario de pago - Solo si NO tiene voucher */}
              {usuario && usuario.rol === 'SOLICITANTE' && expediente.pago && expediente.pago.monto && !expediente.pago.comprobante && (
                <>
                  <div style={{textAlign: 'center', margin: '20px 0'}}>
                    <button 
                      className="btn btn-success btn-lg"
                      onClick={() => {
                        const formulario = document.getElementById('formulario-pago');
                        if (formulario) {
                          formulario.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          formulario.style.animation = 'pulse 0.5s';
                        }
                      }}
                      style={{padding: '12px 32px', fontSize: '16px'}}
                    >
                      <FaUpload style={{marginRight: '8px'}} />
                      Registrar Pago del Banco de la Nación
                    </button>
                  </div>
                  
                  <hr style={{margin: '24px 0', border: '1px dashed #ddd'}} />
                </>
              )}

              {/* Formulario para subir voucher - Solo si NO tiene voucher */}
              {usuario && usuario.rol === 'SOLICITANTE' && expediente.pago && expediente.pago.monto && !expediente.pago.comprobante && (
                <div 
                  id="formulario-pago" 
                  style={{marginTop: '20px', padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px', border: '2px solid #ff9800'}}
                >
                  <h3 style={{marginBottom: '16px', fontSize: '18px', color: '#f57c00'}}>
                    <FaUpload /> Formulario de Registro de Pago - Banco de la Nación
                  </h3>
                  
                  <div style={{marginBottom: '16px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '4px'}}>
                    <p style={{margin: 0, fontSize: '14px'}}>
                      <strong>📌 Instrucciones:</strong> Realice el pago en el Banco de la Nación y adjunte el voucher con los datos de la operación.
                    </p>
                  </div>

                  <div className="grid grid-2" style={{gap: '16px', marginBottom: '16px'}}>
                    <div className="form-group">
                      <label className="form-label">
                        <span style={{color: 'red'}}>* </span>
                        Número de Operación
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej: 001234567890"
                        value={datosVoucher.numeroOperacion}
                        onChange={(e) => setDatosVoucher({...datosVoucher, numeroOperacion: e.target.value})}
                        disabled={subiendoVoucher}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <span style={{color: 'red'}}>* </span>
                        Fecha de Pago
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={datosVoucher.fechaPago}
                        onChange={(e) => setDatosVoucher({...datosVoucher, fechaPago: e.target.value})}
                        disabled={subiendoVoucher}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span style={{color: 'red'}}>* </span>
                      Voucher del Banco de la Nación (Imagen o PDF)
                    </label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleVoucherChange}
                      disabled={subiendoVoucher}
                    />
                    <small className="form-text">
                      Formatos permitidos: JPG, PNG, PDF (máx. 5MB)
                    </small>
                    {voucherFile && (
                      <small className="form-text" style={{color: 'green', display: 'block', marginTop: '8px'}}>
                        ✓ {voucherFile.name}
                      </small>
                    )}
                  </div>

                  <button 
                    className="btn btn-success"
                    onClick={subirVoucher}
                    disabled={!voucherFile || !datosVoucher.numeroOperacion || !datosVoucher.fechaPago || subiendoVoucher}
                    style={{marginTop: '8px'}}
                  >
                    {subiendoVoucher ? 'Registrando pago...' : 'Registrar Pago'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p style={{color: '#999', marginBottom: '16px'}}>No se ha asignado un monto de pago para este expediente</p>
              
              {/* Formulario para que el administrador asigne el monto */}
              {usuario && usuario.rol === 'ADMINISTRADOR' && (
                <div style={{padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px', border: '2px solid #1976d2'}}>
                  <h3 style={{marginBottom: '16px', fontSize: '18px', color: '#1976d2'}}>
                    <FaMoneyBillWave /> Asignar Monto de Pago
                  </h3>
                  
                  <div style={{marginBottom: '16px', padding: '12px', backgroundColor: '#fff3e0', borderRadius: '4px'}}>
                    <p style={{margin: 0, fontSize: '14px'}}>
                      <strong>📌 Instrucciones:</strong> Ingrese el monto que el solicitante debe pagar en el Banco de la Nación por la licencia de construcción.
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span style={{color: 'red'}}>* </span>
                      Monto a Pagar (S/)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Ej: 150.00"
                      step="0.01"
                      min="0"
                      value={montoAsignar}
                      onChange={(e) => setMontoAsignar(e.target.value)}
                      disabled={asignandoMonto}
                    />
                    <small className="form-text">
                      Ingrese el monto calculado según el tipo de obra y área de construcción
                    </small>
                  </div>

                  <button 
                    className="btn btn-primary"
                    onClick={asignarMonto}
                    disabled={!montoAsignar || parseFloat(montoAsignar) <= 0 || asignandoMonto}
                    style={{marginTop: '8px'}}
                  >
                    {asignandoMonto ? 'Asignando monto...' : 'Asignar Monto de Pago'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sección de Licencia Final */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <FaCheckCircle style={{ color: '#27ae60' }} /> Licencia de Construcción
          </h2>
        </div>
        <div className="card-body">
          {expediente.licenciaFinal && expediente.licenciaFinal.ruta ? (
            <div>
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#e8f5e9', 
                borderRadius: '8px', 
                border: '2px solid #27ae60',
                marginBottom: '20px'
              }}>
                <h3 style={{ color: '#27ae60', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaCheckCircle /> ¡Licencia Aprobada y Emitida!
                </h3>
                <p style={{ margin: 0, fontSize: '15px', color: '#2e7d32' }}>
                  Su licencia de construcción ha sido aprobada y está disponible para descarga.
                  {expediente.licenciaFinal.enviadaAlUsuario && (
                    <> También fue enviada a su correo electrónico el {new Date(expediente.licenciaFinal.fechaEnvio).toLocaleString()}.</>
                  )}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                <div>
                  <strong style={{ fontSize: '16px' }}>
                    <FaFilePdf style={{ color: '#d32f2f' }} /> {expediente.licenciaFinal.nombre}
                  </strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
                    Emitida el: {new Date(expediente.licenciaFinal.fechaCarga).toLocaleString()}
                  </p>
                </div>
                <button 
                  className="btn btn-success"
                  onClick={descargarLicencia}
                >
                  <FaDownload /> Descargar Licencia
                </button>
              </div>

              <div style={{ 
                marginTop: '20px', 
                padding: '16px', 
                backgroundColor: '#fff3e0', 
                borderLeft: '4px solid #f39c12', 
                borderRadius: '4px' 
              }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#f57c00', fontSize: '15px' }}>⚠️ Importante:</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#f57c00' }}>
                  <li>Conserve este documento en lugar seguro</li>
                  <li>Debe tener una copia física en el lugar de la obra</li>
                  <li>La licencia debe estar visible durante toda la construcción</li>
                  <li>Cualquier modificación al proyecto requiere nueva aprobación</li>
                </ul>
              </div>
            </div>
          ) : (
            <div>
              {usuario && usuario.rol === 'ADMINISTRADOR' ? (
                <div style={{ 
                  padding: '20px', 
                  backgroundColor: '#e3f2fd', 
                  borderRadius: '8px', 
                  border: '2px solid #1976d2' 
                }}>
                  <h3 style={{ marginBottom: '16px', fontSize: '18px', color: '#1976d2' }}>
                    <FaUpload /> Subir Licencia de Construcción Aprobada
                  </h3>
                  
                  <div style={{ 
                    marginBottom: '16px', 
                    padding: '12px', 
                    backgroundColor: '#fff3e0', 
                    borderRadius: '4px' 
                  }}>
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      <strong>📌 Instrucciones:</strong> Una vez que el expediente haya sido revisado y aprobado por todas las áreas, 
                      suba aquí el PDF de la licencia de construcción oficial. Este documento será enviado automáticamente 
                      al correo electrónico del solicitante.
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span style={{ color: 'red' }}>* </span>
                      Archivo PDF de la Licencia
                    </label>
                    <input
                      type="file"
                      id="licencia-file"
                      className="form-control"
                      accept="application/pdf"
                      onChange={handleLicenciaChange}
                      disabled={subiendoLicencia}
                    />
                    <small className="form-text">
                      Solo archivos PDF. Tamaño máximo: 10MB
                    </small>
                  </div>

                  {licenciaFile && (
                    <div style={{ 
                      padding: '12px', 
                      backgroundColor: '#e8f5e9', 
                      borderRadius: '4px', 
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <FaCheckCircle style={{ color: '#27ae60' }} />
                      <span style={{ fontSize: '14px', color: '#2e7d32' }}>
                        Archivo seleccionado: {licenciaFile.name}
                      </span>
                    </div>
                  )}

                  <div style={{ 
                    marginBottom: '16px', 
                    padding: '12px', 
                    backgroundColor: '#ffebee', 
                    borderLeft: '4px solid #d32f2f', 
                    borderRadius: '4px' 
                  }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#c62828' }}>
                      <strong>⚠️ Atención:</strong> Al subir la licencia, se enviará automáticamente un correo electrónico 
                      al usuario con el documento adjunto. Asegúrese de que el archivo sea el correcto antes de continuar.
                    </p>
                  </div>

                  <button 
                    className="btn btn-success"
                    onClick={subirLicencia}
                    disabled={!licenciaFile || subiendoLicencia}
                    style={{ width: '100%' }}
                  >
                    {subiendoLicencia ? (
                      'Subiendo y enviando licencia...'
                    ) : (
                      <>
                        <FaUpload /> Subir Licencia y Enviar al Usuario
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  <FaFilePdf style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                  <p style={{ margin: 0, fontSize: '16px' }}>
                    La licencia de construcción aún no ha sido emitida
                  </p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                    Recibirá un correo electrónico cuando su licencia esté disponible
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><FaHistory /> Historial</h2>
        </div>
        <div className="card-body">
          {expediente.historial && expediente.historial.length > 0 ? (
            <div className="timeline">
              {expediente.historial.map((item, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-date">
                    {new Date(item.fecha).toLocaleString()}
                  </div>
                  <div className="timeline-content">
                    <strong>{item.accion}</strong>
                    {item.detalles && <p>{item.detalles}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No hay historial disponible</p>
          )}
        </div>
      </div>

      {/* Modal para enviar mensaje */}
      {mostrarModalMensaje && (
        <EnviarMensaje 
          expediente={expediente}
          onClose={() => setMostrarModalMensaje(false)}
          onEnviado={() => {
            queryClient.invalidateQueries(['expediente', id]);
          }}
        />
      )}
    </div>
  );
};

export default DetalleExpediente;
