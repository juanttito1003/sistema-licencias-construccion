const express = require('express');
const router = express.Router();
const Inspeccion = require('../models/Inspeccion');
const Expediente = require('../models/Expediente');
const { auth, requiereRol } = require('../middleware/auth');
const { registrarHistorial } = require('../utils/historial');
const { enviarNotificacion } = require('../utils/notificaciones');

// Programar inspección (RF07)
router.post('/', auth, requiereRol('INSPECTOR', 'ADMINISTRADOR'), async (req, res) => {
  try {
    const { expedienteId, fechaProgramada, tipo } = req.body;

    const expediente = await Expediente.findById(expedienteId);
    if (!expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    const inspeccion = new Inspeccion({
      expediente: expedienteId,
      inspector: req.usuario._id,
      fechaProgramada,
      tipo,
      estado: 'PROGRAMADA'
    });

    await inspeccion.save();

    expediente.inspecciones.push(inspeccion._id);
    await expediente.save();

    await registrarHistorial(expedienteId, {
      accion: 'INSPECCION_PROGRAMADA',
      usuario: req.usuario._id,
      detalles: `Inspección programada para ${new Date(fechaProgramada).toLocaleDateString()}`
    });

    await enviarNotificacion({
      destinatario: expediente.solicitante.email,
      asunto: 'Inspección Programada',
      mensaje: `Se ha programado una inspección para el ${new Date(fechaProgramada).toLocaleDateString()}`
    });

    res.status(201).json({
      mensaje: 'Inspección programada exitosamente',
      inspeccion
    });
  } catch (error) {
    console.error('Error al programar inspección:', error);
    res.status(500).json({ error: 'Error al programar inspección' });
  }
});

// Obtener inspecciones asignadas (RF07)
router.get('/mis-inspecciones', auth, requiereRol('INSPECTOR'), async (req, res) => {
  try {
    const { estado, fecha } = req.query;
    
    let query = { inspector: req.usuario._id };

    if (estado) {
      query.estado = estado;
    }

    if (fecha) {
      const fechaInicio = new Date(fecha);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fecha);
      fechaFin.setHours(23, 59, 59, 999);
      
      query.fechaProgramada = {
        $gte: fechaInicio,
        $lte: fechaFin
      };
    }

    const inspecciones = await Inspeccion.find(query)
      .populate('expediente')
      .populate('inspector', 'nombres apellidos')
      .sort({ fechaProgramada: 1 });

    res.json({ inspecciones });
  } catch (error) {
    console.error('Error al obtener inspecciones:', error);
    res.status(500).json({ error: 'Error al obtener inspecciones' });
  }
});

// Registrar observaciones de inspección (RF08)
router.post('/:id/observaciones', auth, requiereRol('INSPECTOR'), async (req, res) => {
  try {
    const { descripcion, tipo, fotos } = req.body;
    
    const inspeccion = await Inspeccion.findById(req.params.id);
    if (!inspeccion) {
      return res.status(404).json({ error: 'Inspección no encontrada' });
    }

    // Verificar que el inspector sea el asignado
    if (inspeccion.inspector.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta inspección' });
    }

    inspeccion.observaciones.push({
      descripcion,
      tipo,
      fotos: fotos || []
    });

    if (inspeccion.estado === 'PROGRAMADA') {
      inspeccion.estado = 'EN_CURSO';
    }

    await inspeccion.save();

    await registrarHistorial(inspeccion.expediente, {
      accion: 'OBSERVACION_INSPECCION',
      usuario: req.usuario._id,
      detalles: `Observación registrada: ${tipo}`
    });

    res.json({
      mensaje: 'Observación registrada exitosamente',
      inspeccion
    });
  } catch (error) {
    console.error('Error al registrar observación:', error);
    res.status(500).json({ error: 'Error al registrar observación' });
  }
});

// Finalizar inspección
router.patch('/:id/finalizar', auth, requiereRol('INSPECTOR'), async (req, res) => {
  try {
    const { resultado, informe, coordenadas } = req.body;
    
    const inspeccion = await Inspeccion.findById(req.params.id).populate('expediente');
    if (!inspeccion) {
      return res.status(404).json({ error: 'Inspección no encontrada' });
    }

    // Verificar que el inspector sea el asignado
    if (inspeccion.inspector.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta inspección' });
    }

    inspeccion.estado = 'COMPLETADA';
    inspeccion.resultado = resultado;
    inspeccion.informe = informe;
    inspeccion.fechaRealizada = Date.now();
    if (coordenadas) {
      inspeccion.coordenadas = coordenadas;
    }

    await inspeccion.save();

    // Actualizar estado del expediente
    const expediente = await Expediente.findById(inspeccion.expediente._id);
    if (resultado === 'CONFORME') {
      expediente.estado = 'EN_REVISION_TECNICA';
    } else {
      expediente.estado = 'OBSERVADO';
    }
    await expediente.save();

    await registrarHistorial(inspeccion.expediente._id, {
      accion: 'INSPECCION_COMPLETADA',
      usuario: req.usuario._id,
      detalles: `Inspección completada con resultado: ${resultado}`
    });

    await enviarNotificacion({
      destinatario: expediente.solicitante.email,
      asunto: 'Inspección Completada',
      mensaje: `La inspección de su expediente ha sido completada con resultado: ${resultado}`
    });

    res.json({
      mensaje: 'Inspección finalizada exitosamente',
      inspeccion
    });
  } catch (error) {
    console.error('Error al finalizar inspección:', error);
    res.status(500).json({ error: 'Error al finalizar inspección' });
  }
});

module.exports = router;
