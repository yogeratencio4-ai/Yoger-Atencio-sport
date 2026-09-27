export default async function handler(request, response) {
  try {
    const {
      home = "",
      away = ""
    } = request.query || {};

    if (!home || !away) {
      return response.status(400).json({
        success: false,
        error: "Faltan los equipos. Usa ?home=EquipoLocal&away=EquipoVisitante"
      });
    }

    /*
      MOTOR BASE DE PRONÓSTICOS

      IMPORTANTE:
      Este endpoint NO consulta API-Football.
      Por lo tanto no consume los puntos diarios.

      La estructura queda preparada para recibir
      posteriormente datos estadísticos de varias fuentes.
    */

    const predictions = {
      partido: {
        local: home,
        visitante: away
      },

      unoXdos: {
        local: null,
        empate: null,
        visitante: null
      },

      goles: {
        mas15: null,
        menos35: null
      },

      btts: {
        si: null,
        no: null
      },

      corners: {
        mas65: null,
        menos115: null
      },

      tarjetas: {
        mas35: null,
        menos55: null
      },

      otros: [],

      fuentes: [],

      estado: "pendiente",

      mensaje:
        "El consenso se calculará cuando estén disponibles los datos estadísticos de las fuentes."
    };

    return response.status(200).json({
      success: true,
      predictions
    });

  } catch (error) {

    return response.status(500).json({
      success: false,
      error: "Error interno del servidor"
    });

  }
}
