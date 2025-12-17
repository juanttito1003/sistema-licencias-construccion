const mongoose = require('mongoose');

const expedienteSchema = new mongoose.Schema({
  numeroExpediente: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  solicitante: {
    nombres: { type: String, required: true },
    apellidos: { type: String, required: true },
    dni: { type: String, required: true },
    email: { type: String, required: true },
    telefono: { type: String, required: true },
    direccion: String
  },
  proyecto: {
    nombreProyecto: { type: String, required: true },
    direccionProyecto: { type: String, required: true },
    distrito: { type: String, required: true },
    areaTerreno: Number,
    areaConstruccion: { 
      type: Number, 
      max: [120, 'El área de construcción no puede superar los 120 m² (Modalidad A)']
    },
    numeroNiveles: Number,
    usoProyecto: String,
    // Modalidad A - Nuevos campos
    tipoObra: {
      type: String,
      enum: ['CONSTRUCCION_NUEVA', 'AMPLIACION', 'OBRA_MENOR', 'REMODELACION', 'CERCO', 'DEMOLICION', 'MILITAR_POLICIAL']
    },
    esPropietario: { type: String, enum: ['SI', 'NO'], default: 'SI' },
    esPersonaJuridica: { type: String, enum: ['SI', 'NO'], default: 'NO' }
  },
  documentos: {
    // Documentos Administrativos
    formularioUnico: {
      nombre: String,
      ruta: String,
      fechaCarga: Date
    },
    certificadoLiteral: {
      nombre: String,
      ruta: String,
      fechaCarga: Date
    },
    declaracionJurada: {
      nombre: String,
      ruta: String,
      fechaCarga: Date
    },
    documentoDerecho: {
      nombre: String,
      ruta: String,
      fechaCarga: Date
    },
    vigenciaPoder: {
      nombre: String,
      ruta: String,
      fechaCarga: Date
    },
    licenciaAnterior: {
      nombre: String,
      ruta: String,
      fechaCarga: Date
    },
    // Documentación Técnica
    planoUbicacion: {
      nombre: String,
      ruta: String,
      fechaCarga: Date
    },
    planosArquitectura: {
      nombre: String,
      ruta: String,
      fechaCarga: Date
    },
    planosEspecialidades: {
      nombre: String,
      ruta: String,
      fechaCarga: Date
    },
    planoSenalizacion: {
      nombre: String,
      ruta: String,
      fechaCarga: Date
    },
    cartaSeguridad: {
      nombre: String,
      ruta: String,
      fechaCarga: Date
    }
  },
  documentosAdministrativos: [{
    tipo: { 
      type: String, 
      enum: ['FUE', 'CERTIFICADO_ZONIFICACION', 'DECLARACION_JURADA', 'PODER', 'OTRO'],
      required: true 
    },
    nombre: String,
    url: String,
    fechaCarga: { type: Date, default: Date.now },
    estado: { 
      type: String, 
      enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'OBSERVADO'],
      default: 'PENDIENTE'
    },
    observaciones: String
  }],
  planosTecnicos: [{
    tipo: { 
      type: String, 
      enum: ['ARQUITECTURA', 'ESTRUCTURAS', 'INSTALACIONES_SANITARIAS', 'INSTALACIONES_ELECTRICAS'],
      required: true 
    },
    nombre: String,
    url: String,
    fechaCarga: { type: Date, default: Date.now },
    estado: { 
      type: String, 
      enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'OBSERVADO'],
      default: 'PENDIENTE'
    },
    observaciones: String
  }],
  estado: {
    type: String,
    enum: [
      'REGISTRADO',
      'EN_REVISION_ADMINISTRATIVA',
      'EN_REVISION_TECNICA',
      'OBSERVADO',
      'SUBSANACION',
      'PENDIENTE_INSPECCION',
      'EN_INSPECCION',
      'PENDIENTE_PAGO',
      'PAGADO',
      'APROBADO',
      'RECHAZADO',
      'LICENCIA_EMITIDA'
    ],
    default: 'REGISTRADO'
  },
  pago: {
    monto: Number,
    comprobante: String,
    numeroOperacion: String,
    fechaOperacion: Date,
    fechaPago: Date,
    metodoPago: { type: String, default: 'BANCO_NACION' },
    estado: { 
      type: String, 
      enum: ['PENDIENTE', 'PAGADO', 'VERIFICADO'],
      default: 'PENDIENTE'
    }
  },
  inspecciones: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inspeccion'
  }],
  historial: [{
    accion: String,
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    fecha: { type: Date, default: Date.now },
    detalles: String,
    estadoAnterior: String,
    estadoNuevo: String
  }],
  revisorAdministrativo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  revisorTecnico: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  resolucionFinal: {
    numero: String,
    fecha: Date,
    documento: String,
    observaciones: String
  },
  licenciaFinal: {
    nombre: String,
    ruta: String,
    fechaCarga: Date,
    enviadaAlUsuario: { type: Boolean, default: false },
    fechaEnvio: Date
  },
  fechaCreacion: { type: Date, default: Date.now },
  fechaActualizacion: { type: Date, default: Date.now }
}, { timestamps: true });

// Middleware para actualizar fecha de actualización
expedienteSchema.pre('save', function(next) {
  this.fechaActualizacion = Date.now();
  next();
});

// Generar número de expediente único
expedienteSchema.statics.generarNumeroExpediente = async function() {
  const año = new Date().getFullYear();
  const ultimoExpediente = await this.findOne({
    numeroExpediente: new RegExp(`^EXP-${año}-`)
  }).sort({ numeroExpediente: -1 });
  
  let numero = 1;
  if (ultimoExpediente) {
    const partes = ultimoExpediente.numeroExpediente.split('-');
    numero = parseInt(partes[2]) + 1;
  }
  
  return `EXP-${año}-${String(numero).padStart(6, '0')}`;
};

module.exports = mongoose.model('Expediente', expedienteSchema);
