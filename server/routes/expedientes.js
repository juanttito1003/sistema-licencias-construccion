const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Expediente = require('../models/Expediente');
const Usuario = require('../models/Usuario');
const { auth, requiereRol } = require('../middleware/auth');
const { registrarHistorial } = require('../utils/historial');
const { enviarNotificacion } = require('../utils/notificaciones');
const { enviarMensajeExpediente, enviarLicenciaAprobada } = require('../utils/email');

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/expedientes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF o imágenes (JPG, PNG)'));
    }
  }
});

// Crear nuevo expediente (RF01, RF05)
router.post('/', auth, upload.fields([
  { name: 'formularioUnico', maxCount: 1 },
  { name: 'certificadoLiteral', maxCount: 1 },
  { name: 'declaracionJurada', maxCount: 1 },
  { name: 'documentoDerecho', maxCount: 1 },
  { name: 'vigenciaPoder', maxCount: 1 },
  { name: 'licenciaAnterior', maxCount: 1 },
  { name: 'planoUbicacion', maxCount: 1 },
  { name: 'planosArquitectura', maxCount: 1 },
  { name: 'planosEspecialidades', maxCount: 1 },
  { name: 'planoSenalizacion', maxCount: 1 },
  { name: 'cartaSeguridad', maxCount: 1 }
]), async (req, res) => {
  try {
    const datos = JSON.parse(req.body.datos);
    const { solicitante, proyecto } = datos;

    // Generar número de expediente único
    const numeroExpediente = await Expediente.generarNumeroExpediente();

    // Construir objeto de documentos cargados
    const documentos = {};
    if (req.files) {
      Object.keys(req.files).forEach(fieldName => {
        if (req.files[fieldName] && req.files[fieldName][0]) {
          // Guardar solo la ruta relativa (uploads/expedientes/archivo.pdf)
          const rutaCompleta = req.files[fieldName][0].path;
          const rutaRelativa = rutaCompleta.replace(/\\/g, '/').split('uploads/')[1];
          
          documentos[fieldName] = {
            nombre: req.files[fieldName][0].originalname,
            ruta: `uploads/${rutaRelativa}`,
            fechaCarga: new Date()
          };
        }
      });
    }

    const expediente = new Expediente({
      numeroExpediente,
      solicitante: {
        ...solicitante,
        email: req.usuario.email
      },
      proyecto,
      documentos,
      estado: 'REGISTRADO'
    });

    await expediente.save();

    // Registrar en historial
    await registrarHistorial(expediente._id, {
      accion: 'CREACION_EXPEDIENTE',
      usuario: req.usuario._id,
      detalles: `Expediente ${numeroExpediente} creado con ${Object.keys(documentos).length} documento(s)`,
      estadoNuevo: 'REGISTRADO'
    });

    // Enviar notificación
    await enviarNotificacion({
      destinatario: solicitante.email,
      asunto: 'Expediente Registrado',
      mensaje: `Su expediente ${numeroExpediente} ha sido registrado exitosamente.`
    });

    res.status(201).json({ 
      mensaje: 'Expediente creado exitosamente',
      expediente 
    });
  } catch (error) {
    console.error('Error al crear expediente:', error);
    res.status(500).json({ error: error.message || 'Error al crear expediente' });
  }
});

// Obtener todos los expedientes (con filtros)
router.get('/', auth, async (req, res) => {
  try {
    const { estado, search, page = 1, limit = 10 } = req.query;
    
    let query = {};

    // Filtrar según rol
    if (req.usuario.rol === 'SOLICITANTE') {
      query['solicitante.email'] = req.usuario.email;
    }

    if (estado) {
      query.estado = estado;
    }

    if (search) {
      query.$or = [
        { numeroExpediente: new RegExp(search, 'i') },
        { 'solicitante.nombres': new RegExp(search, 'i') },
        { 'solicitante.apellidos': new RegExp(search, 'i') },
        { 'proyecto.nombreProyecto': new RegExp(search, 'i') }
      ];
    }

    const expedientes = await Expediente.find(query)
      .sort({ fechaCreacion: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('revisorAdministrativo revisorTecnico', 'nombres apellidos');

    const total = await Expediente.countDocuments(query);

    res.json({
      expedientes,
      totalPaginas: Math.ceil(total / limit),
      paginaActual: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Error al obtener expedientes:', error);
    res.status(500).json({ error: 'Error al obtener expedientes' });
  }
});

// Obtener expediente por ID (RF09)
router.get('/:id', auth, async (req, res) => {
  try {
    const expediente = await Expediente.findById(req.params.id)
      .populate('revisorAdministrativo revisorTecnico', 'nombres apellidos')
      .populate('inspecciones')
      .populate('historial.usuario', 'nombres apellidos');

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    // Verificar permisos
    if (req.usuario.rol === 'SOLICITANTE' && 
        expediente.solicitante.email !== req.usuario.email) {
      return res.status(403).json({ error: 'No tienes permiso para ver este expediente' });
    }

    res.json(expediente);
  } catch (error) {
    console.error('Error al obtener expediente:', error);
    res.status(500).json({ error: 'Error al obtener expediente' });
  }
});

// Actualizar estado del expediente (RF11, RF12)
router.patch('/:id/estado', auth, requiereRol('REVISOR_ADMINISTRATIVO', 'REVISOR_TECNICO', 'ADMINISTRADOR'), async (req, res) => {
  try {
    const { estado, observaciones } = req.body;
    const expediente = await Expediente.findById(req.params.id);

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    const estadoAnterior = expediente.estado;
    expediente.estado = estado;

    await expediente.save();

    // Registrar en historial
    await registrarHistorial(expediente._id, {
      accion: 'CAMBIO_ESTADO',
      usuario: req.usuario._id,
      detalles: observaciones || `Estado cambiado de ${estadoAnterior} a ${estado}`,
      estadoAnterior,
      estadoNuevo: estado
    });

    // Enviar notificación (RF10)
    await enviarNotificacion({
      destinatario: expediente.solicitante.email,
      asunto: `Actualización de Expediente ${expediente.numeroExpediente}`,
      mensaje: `Su expediente ha cambiado de estado a: ${estado}`
    });

    res.json({ 
      mensaje: 'Estado actualizado exitosamente',
      expediente 
    });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// Validar documentación completa (RF04)
router.get('/:id/validar', auth, async (req, res) => {
  try {
    const expediente = await Expediente.findById(req.params.id);

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    const documentosRequeridos = ['FUE', 'CERTIFICADO_ZONIFICACION', 'DECLARACION_JURADA'];
    const planosRequeridos = ['ARQUITECTURA', 'ESTRUCTURAS', 'INSTALACIONES_SANITARIAS', 'INSTALACIONES_ELECTRICAS'];

    const documentosFaltantes = documentosRequeridos.filter(tipo => 
      !expediente.documentosAdministrativos.some(doc => doc.tipo === tipo)
    );

    const planosFaltantes = planosRequeridos.filter(tipo => 
      !expediente.planosTecnicos.some(plano => plano.tipo === tipo)
    );

    const completo = documentosFaltantes.length === 0 && planosFaltantes.length === 0;

    res.json({
      completo,
      documentosFaltantes,
      planosFaltantes
    });
  } catch (error) {
    console.error('Error al validar documentación:', error);
    res.status(500).json({ error: 'Error al validar documentación' });
  }
});

// Asignar monto de pago (solo administradores)
router.put('/:id/pago', auth, requiereRol('ADMINISTRADOR'), async (req, res) => {
  try {
    const { monto } = req.body;
    
    if (!monto || parseFloat(monto) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const expediente = await Expediente.findById(req.params.id);
    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    // Asignar monto
    expediente.pago = {
      monto: parseFloat(monto),
      estado: 'PENDIENTE',
      metodoPago: 'BANCO_NACION'
    };

    await expediente.save();

    // Registrar en historial
    await registrarHistorial(expediente._id, {
      accion: 'ASIGNACION_MONTO',
      usuario: req.usuario._id,
      detalles: `Monto de pago asignado: S/ ${monto}`,
      estadoNuevo: expediente.estado
    });

    // Enviar notificación al solicitante
    await enviarNotificacion({
      destinatario: expediente.solicitante.email,
      asunto: 'Monto de Pago Asignado',
      mensaje: `Se ha asignado el monto de pago para el expediente ${expediente.numeroExpediente}. Monto: S/ ${monto}. Debe realizar el pago en el Banco de la Nación y subir el voucher.`
    });

    res.json({ 
      mensaje: 'Monto asignado correctamente',
      expediente 
    });
  } catch (error) {
    console.error('Error al asignar monto:', error);
    res.status(500).json({ error: 'Error al asignar monto de pago' });
  }
});

// Subir voucher de pago
router.post('/:id/voucher', auth, upload.single('voucher'), async (req, res) => {
  try {
    const { numeroOperacion, fechaPago } = req.body;
    const expediente = await Expediente.findById(req.params.id);

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    // Verificar permisos
    if (req.usuario.rol === 'SOLICITANTE' && 
        expediente.solicitante.email !== req.usuario.email) {
      return res.status(403).json({ error: 'No tienes permiso para modificar este expediente' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
    }

    if (!numeroOperacion || !fechaPago) {
      return res.status(400).json({ error: 'Debe proporcionar número de operación y fecha de pago' });
    }

    // Actualizar información de pago con el voucher
    if (!expediente.pago) {
      expediente.pago = {};
    }
    
    // Guardar solo la ruta relativa del voucher
    const rutaCompleta = req.file.path;
    const rutaRelativa = rutaCompleta.replace(/\\/g, '/').split('uploads/')[1];
    
    expediente.pago.comprobante = `uploads/${rutaRelativa}`;
    expediente.pago.numeroOperacion = numeroOperacion;
    expediente.pago.fechaOperacion = new Date(fechaPago);
    expediente.pago.fechaPago = new Date();
    expediente.pago.metodoPago = 'BANCO_NACION';
    expediente.pago.estado = 'PAGADO';

    await expediente.save();

    // Registrar en historial
    await registrarHistorial(expediente._id, {
      accion: 'VOUCHER_SUBIDO',
      usuario: req.usuario._id,
      detalles: `Voucher de pago del Banco de la Nación registrado. N° Operación: ${numeroOperacion}`
    });

    // Enviar notificación
    await enviarNotificacion({
      destinatario: expediente.solicitante.email,
      asunto: `Pago Registrado - Expediente ${expediente.numeroExpediente}`,
      mensaje: `Su comprobante de pago ha sido registrado exitosamente. N° Operación: ${numeroOperacion}`
    });

    res.json({ 
      mensaje: 'Voucher y datos de pago registrados exitosamente',
      expediente 
    });
  } catch (error) {
    console.error('Error al subir voucher:', error);
    res.status(500).json({ error: error.message || 'Error al subir voucher' });
  }
});

// Enviar mensaje personalizado al usuario (solo ADMINISTRADOR)
router.post('/:id/enviar-mensaje', auth, requiereRol('ADMINISTRADOR'), async (req, res) => {
  try {
    const { asunto, mensaje } = req.body;

    if (!asunto || !mensaje) {
      return res.status(400).json({ error: 'El asunto y el mensaje son requeridos' });
    }

    // Buscar expediente con datos del solicitante
    const expediente = await Expediente.findById(req.params.id).populate('solicitante');

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    if (!expediente.solicitante) {
      return res.status(400).json({ error: 'El expediente no tiene un solicitante asociado' });
    }

    // Enviar email
    const resultado = await enviarMensajeExpediente(
      expediente.solicitante,
      expediente,
      asunto,
      mensaje
    );

    if (!resultado.success) {
      return res.status(500).json({ error: 'Error al enviar el mensaje' });
    }

    // Registrar en historial
    await registrarHistorial(
      req.params.id,
      'MENSAJE_ENVIADO',
      `Mensaje enviado: ${asunto}`,
      req.usuario.id
    );

    res.json({ 
      mensaje: 'Mensaje enviado exitosamente',
      emailEnviado: resultado.success
    });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: error.message || 'Error al enviar mensaje' });
  }
});

// Configuración de multer para licencia final (solo PDF)
const uploadLicencia = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF para la licencia'));
    }
  }
});

// Subir licencia final y enviar al usuario (solo ADMINISTRADOR)
router.post('/:id/subir-licencia', auth, requiereRol('ADMINISTRADOR'), uploadLicencia.single('licencia'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debe adjuntar el archivo PDF de la licencia' });
    }

    const expediente = await Expediente.findById(req.params.id);

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    // Buscar usuario solicitante
    const usuario = await Usuario.findById(expediente.solicitante);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario solicitante no encontrado' });
    }

    // Convertir ruta a relativa
    let rutaRelativa = req.file.path.replace(/\\/g, '/');
    if (rutaRelativa.includes('uploads/')) {
      rutaRelativa = 'uploads/' + rutaRelativa.split('uploads/')[1];
    }

    // Guardar información de la licencia en el expediente
    expediente.licenciaFinal = {
      nombre: req.file.originalname,
      ruta: rutaRelativa,
      fechaCarga: new Date(),
      enviadaAlUsuario: false
    };

    // Actualizar estado a LICENCIA_EMITIDA
    expediente.estado = 'LICENCIA_EMITIDA';

    await expediente.save();

    // Enviar licencia por correo con archivo adjunto
    const rutaCompleta = path.join(__dirname, '../../', rutaRelativa);
    const resultado = await enviarLicenciaAprobada(usuario, expediente, rutaCompleta);

    if (resultado.success) {
      // Marcar como enviada
      expediente.licenciaFinal.enviadaAlUsuario = true;
      expediente.licenciaFinal.fechaEnvio = new Date();
      await expediente.save();
    }

    // Registrar en historial
    await registrarHistorial(
      req.params.id,
      'LICENCIA_EMITIDA',
      `Licencia de construcción emitida y enviada al usuario: ${usuario.email}`,
      req.usuario.id
    );

    res.json({ 
      mensaje: 'Licencia subida y enviada exitosamente al usuario',
      expediente,
      emailEnviado: resultado.success
    });
  } catch (error) {
    console.error('Error al subir licencia:', error);
    res.status(500).json({ error: error.message || 'Error al subir licencia' });
  }
});

// Descargar licencia final
router.get('/:id/descargar-licencia', auth, async (req, res) => {
  try {
    const expediente = await Expediente.findById(req.params.id);

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    if (!expediente.licenciaFinal || !expediente.licenciaFinal.ruta) {
      return res.status(404).json({ error: 'No hay licencia disponible para este expediente' });
    }

    // Verificar permisos: admin o el mismo solicitante
    if (req.usuario.rol !== 'ADMINISTRADOR' && expediente.solicitante.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No tiene permiso para descargar esta licencia' });
    }

    const rutaArchivo = path.join(__dirname, '../../', expediente.licenciaFinal.ruta);

    if (!fs.existsSync(rutaArchivo)) {
      return res.status(404).json({ error: 'Archivo de licencia no encontrado en el servidor' });
    }

    res.download(rutaArchivo, expediente.licenciaFinal.nombre);
  } catch (error) {
    console.error('Error al descargar licencia:', error);
    res.status(500).json({ error: error.message || 'Error al descargar licencia' });
  }
});

module.exports = router;
