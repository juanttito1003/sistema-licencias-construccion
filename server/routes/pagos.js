const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Expediente = require('../models/Expediente');
const { auth } = require('../middleware/auth');
const { registrarHistorial } = require('../utils/historial');
const { enviarNotificacion } = require('../utils/notificaciones');

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(__dirname, '../../uploads/pagos'));
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Registrar pago (RF06)
router.post('/:expedienteId', auth, upload.single('comprobante'), async (req, res) => {
  try {
    const { monto, metodoPago } = req.body;
    const expediente = await Expediente.findById(req.params.expedienteId);

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    // Verificar permisos
    if (req.usuario.rol === 'SOLICITANTE' && 
        expediente.solicitante.email !== req.usuario.email) {
      return res.status(403).json({ error: 'No tienes permiso para modificar este expediente' });
    }

    expediente.pago = {
      monto: parseFloat(monto),
      comprobante: req.file ? `/uploads/pagos/${req.file.filename}` : null,
      fechaPago: Date.now(),
      metodoPago,
      estado: 'PAGADO'
    };

    expediente.estado = 'PAGADO';
    await expediente.save();

    await registrarHistorial(expediente._id, {
      accion: 'PAGO_REGISTRADO',
      usuario: req.usuario._id,
      detalles: `Pago de S/ ${monto} registrado vía ${metodoPago}`,
      estadoAnterior: expediente.estado,
      estadoNuevo: 'PAGADO'
    });

    await enviarNotificacion({
      destinatario: expediente.solicitante.email,
      asunto: 'Pago Registrado',
      mensaje: `El pago de S/ ${monto} ha sido registrado exitosamente.`
    });

    res.json({
      mensaje: 'Pago registrado exitosamente',
      pago: expediente.pago
    });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: 'Error al registrar pago' });
  }
});

// Verificar pago
router.patch('/:expedienteId/verificar', auth, async (req, res) => {
  try {
    const expediente = await Expediente.findById(req.params.expedienteId);

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    if (!expediente.pago || expediente.pago.estado === 'PENDIENTE') {
      return res.status(400).json({ error: 'No hay pago registrado' });
    }

    expediente.pago.estado = 'VERIFICADO';
    await expediente.save();

    await registrarHistorial(expediente._id, {
      accion: 'PAGO_VERIFICADO',
      usuario: req.usuario._id,
      detalles: 'Pago verificado por administración'
    });

    res.json({
      mensaje: 'Pago verificado exitosamente',
      pago: expediente.pago
    });
  } catch (error) {
    console.error('Error al verificar pago:', error);
    res.status(500).json({ error: 'Error al verificar pago' });
  }
});

module.exports = router;
