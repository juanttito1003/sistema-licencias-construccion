const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Expediente = require('../models/Expediente');
const { auth } = require('../middleware/auth');
const { registrarHistorial } = require('../utils/historial');

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../../uploads', req.params.expedienteId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|jpg|jpeg|png|dwg|dxf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || 
                   file.mimetype === 'application/acad' ||
                   file.mimetype === 'application/x-autocad';

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF, imágenes JPG/PNG o planos DWG/DXF'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 }, // 10MB por defecto
  fileFilter: fileFilter
});

// Subir documento administrativo (RF02)
router.post('/:expedienteId/administrativo', auth, upload.single('documento'), async (req, res) => {
  try {
    const { tipo, nombre } = req.body;
    const expediente = await Expediente.findById(req.params.expedienteId);

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    // Verificar permisos
    if (req.usuario.rol === 'SOLICITANTE' && 
        expediente.solicitante.email !== req.usuario.email) {
      return res.status(403).json({ error: 'No tienes permiso para modificar este expediente' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    const documento = {
      tipo,
      nombre: nombre || req.file.originalname,
      url: `/uploads/${req.params.expedienteId}/${req.file.filename}`,
      estado: 'PENDIENTE'
    };

    expediente.documentosAdministrativos.push(documento);
    await expediente.save();

    await registrarHistorial(expediente._id, {
      accion: 'CARGA_DOCUMENTO',
      usuario: req.usuario._id,
      detalles: `Documento administrativo cargado: ${tipo}`
    });

    res.status(201).json({ 
      mensaje: 'Documento cargado exitosamente',
      documento 
    });
  } catch (error) {
    console.error('Error al subir documento:', error);
    res.status(500).json({ error: error.message || 'Error al subir documento' });
  }
});

// Subir plano técnico (RF03)
router.post('/:expedienteId/plano', auth, upload.single('plano'), async (req, res) => {
  try {
    const { tipo, nombre } = req.body;
    const expediente = await Expediente.findById(req.params.expedienteId);

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    // Verificar permisos
    if (req.usuario.rol === 'SOLICITANTE' && 
        expediente.solicitante.email !== req.usuario.email) {
      return res.status(403).json({ error: 'No tienes permiso para modificar este expediente' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    const plano = {
      tipo,
      nombre: nombre || req.file.originalname,
      url: `/uploads/${req.params.expedienteId}/${req.file.filename}`,
      estado: 'PENDIENTE'
    };

    expediente.planosTecnicos.push(plano);
    await expediente.save();

    await registrarHistorial(expediente._id, {
      accion: 'CARGA_PLANO',
      usuario: req.usuario._id,
      detalles: `Plano técnico cargado: ${tipo}`
    });

    res.status(201).json({ 
      mensaje: 'Plano cargado exitosamente',
      plano 
    });
  } catch (error) {
    console.error('Error al subir plano:', error);
    res.status(500).json({ error: error.message || 'Error al subir plano' });
  }
});

// Aprobar/Rechazar documento (RF11)
router.patch('/:expedienteId/documento/:documentoId', auth, async (req, res) => {
  try {
    const { estado, observaciones } = req.body;
    const expediente = await Expediente.findById(req.params.expedienteId);

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    const documento = expediente.documentosAdministrativos.id(req.params.documentoId);
    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    documento.estado = estado;
    documento.observaciones = observaciones;

    await expediente.save();

    await registrarHistorial(expediente._id, {
      accion: 'REVISION_DOCUMENTO',
      usuario: req.usuario._id,
      detalles: `Documento ${documento.tipo} marcado como ${estado}`
    });

    res.json({ 
      mensaje: 'Documento actualizado exitosamente',
      documento 
    });
  } catch (error) {
    console.error('Error al actualizar documento:', error);
    res.status(500).json({ error: 'Error al actualizar documento' });
  }
});

// Aprobar/Rechazar plano (RF11)
router.patch('/:expedienteId/plano/:planoId', auth, async (req, res) => {
  try {
    const { estado, observaciones } = req.body;
    const expediente = await Expediente.findById(req.params.expedienteId);

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    const plano = expediente.planosTecnicos.id(req.params.planoId);
    if (!plano) {
      return res.status(404).json({ error: 'Plano no encontrado' });
    }

    plano.estado = estado;
    plano.observaciones = observaciones;

    await expediente.save();

    await registrarHistorial(expediente._id, {
      accion: 'REVISION_PLANO',
      usuario: req.usuario._id,
      detalles: `Plano ${plano.tipo} marcado como ${estado}`
    });

    res.json({ 
      mensaje: 'Plano actualizado exitosamente',
      plano 
    });
  } catch (error) {
    console.error('Error al actualizar plano:', error);
    res.status(500).json({ error: 'Error al actualizar plano' });
  }
});

module.exports = router;
