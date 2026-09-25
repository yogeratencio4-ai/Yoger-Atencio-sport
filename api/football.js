export default async function handler(request, response) {
  try {
    const API_KEY = process.env.API_FOOTBALL_KEY;

    if (!API_KEY) {
      return response.status(500).json({
        error: "Falta configurar API_FOOTBALL_KEY en Vercel"
      });
    }

    const headers = {
      "x-apisports-key": API_KEY
    };

    const ahora = new Date();

    const hoy = ahora.toISOString().split("T")[0];

    const mananaFecha = new Date(ahora);
    mananaFecha.setUTCDate(mananaFecha.getUTCDate() + 1);
    const manana = mananaFecha.toISOString().split("T")[0];

    // ============================================
    // PARTIDOS EN VIVO
    // ============================================

    const liveResponse = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
      {
        headers
      }
    );

    const liveData = await liveResponse.json();

    if (!liveResponse.ok) {
      return response.status(liveResponse.status).json({
        error: "Error obteniendo partidos en vivo",
        detalles: liveData
      });
    }

    const enVivo = liveData.response || [];

    // ============================================
    // PARTIDOS DE HOY
    // ============================================

    const hoyResponse = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${hoy}`,
      {
        headers
      }
    );

    const hoyData = await hoyResponse.json();

    if (!hoyResponse.ok) {
      return response.status(hoyResponse.status).json({
        error: "Error obteniendo partidos de hoy",
        detalles: hoyData
      });
    }

    const partidosHoy = hoyData.response || [];

    // ============================================
    // PARTIDOS DE MAÑANA
    // ============================================

    const mananaResponse = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${manana}`,
      {
        headers
      }
    );

    const mananaData = await mananaResponse.json();

    if (!mananaResponse.ok) {
      return response.status(mananaResponse.status).json({
        error: "Error obteniendo partidos de mañana",
        detalles: mananaData
      });
    }

    const partidosManana = mananaData.response || [];

    // ============================================
    // ELIMINAR DUPLICADOS
    // ============================================

    const mapa = new Map();

    [
      ...enVivo,
      ...partidosHoy,
      ...partidosManana
    ].forEach((partido) => {
      if (partido && partido.fixture && partido.fixture.id) {
        mapa.set(partido.fixture.id, partido);
      }
    });

    const partidos = Array.from(mapa.values());

    // ============================================
    // RESPUESTA
    // ============================================

    return response.status(200).json({
      success: true,

      fechaActual: ahora.toISOString(),

      hoy,
      manana,

      cantidadEnVivo: enVivo.length,
      cantidadHoy: partidosHoy.length,
      cantidadManana: partidosManana.length,
      cantidadTotal: partidos.length,

      enVivo,

      partidosHoy,

      partidosManana,

      partidos
    });

  } catch (error) {
    console.error("ERROR FOOTBALL API:", error);

    return response.status(500).json({
      success: false,
      error: "Error interno del servidor",
      detalles: error.message
    });
  }
}
