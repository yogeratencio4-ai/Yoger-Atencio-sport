export default async function handler(req, res) {
  try {
    const API_KEY = process.env.API_FOOTBALL_KEY;

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Falta API_FOOTBALL_KEY en Vercel"
      });
    }

    const hoy = new Date();

    const mananaFecha = new Date(hoy);
    mananaFecha.setUTCDate(mananaFecha.getUTCDate() + 1);

    const fechaHoy = hoy.toISOString().slice(0, 10);
    const fechaManana = mananaFecha.toISOString().slice(0, 10);

    const headers = {
      "x-apisports-key": API_KEY,
      "Accept": "application/json"
    };

    async function consultar(url) {
      const respuesta = await fetch(url, {
        method: "GET",
        headers,
        cache: "no-store"
      });

      const texto = await respuesta.text();

      let datos;

      try {
        datos = JSON.parse(texto);
      } catch {
        throw new Error(
          "API-Football devolvió una respuesta que no es JSON"
        );
      }

      if (!respuesta.ok) {
        throw new Error(
          datos?.message ||
          datos?.errors?.requests ||
          `Error HTTP ${respuesta.status}`
        );
      }

      return datos;
    }

    let datosVivo = {
      response: [],
      errors: {}
    };

    let datosHoy = {
      response: [],
      errors: {}
    };

    let datosManana = {
      response: [],
      errors: {}
    };

    const errores = {
      live: null,
      hoy: null,
      manana: null
    };

    // =========================
    // PARTIDOS EN VIVO
    // =========================

    try {
      datosVivo = await consultar(
        "https://v3.football.api-sports.io/fixtures?live=all"
      );
    } catch (error) {
      errores.live = error.message;
    }

    // =========================
    // PARTIDOS DE HOY
    // =========================

    try {
      datosHoy = await consultar(
        `https://v3.football.api-sports.io/fixtures?date=${fechaHoy}`
      );
    } catch (error) {
      errores.hoy = error.message;
    }

    // =========================
    // PARTIDOS DE MAÑANA
    // =========================

    try {
      datosManana = await consultar(
        `https://v3.football.api-sports.io/fixtures?date=${fechaManana}`
      );
    } catch (error) {
      errores.manana = error.message;
    }

    // =========================
    // ARRAYS
    // =========================

    const enVivo = Array.isArray(datosVivo.response)
      ? datosVivo.response
      : [];

    const partidosHoy = Array.isArray(datosHoy.response)
      ? datosHoy.response
      : [];

    const partidosManana = Array.isArray(datosManana.response)
      ? datosManana.response
      : [];

    // =========================
    // UNIR Y ELIMINAR DUPLICADOS
    // =========================

    const mapa = new Map();

    [
      ...enVivo,
      ...partidosHoy,
      ...partidosManana
    ].forEach(partido => {

      if (
        partido &&
        partido.fixture &&
        partido.fixture.id
      ) {
        mapa.set(
          partido.fixture.id,
          partido
        );
      }

    });

    const partidos = Array.from(mapa.values());

    // =========================
    // RESPUESTA
    // =========================

    return res.status(200).json({

      success: true,

      fechaActual: new Date().toISOString(),

      hoy: fechaHoy,

      manana: fechaManana,

      cantidadEnVivo: enVivo.length,

      cantidadHoy: partidosHoy.length,

      cantidadManana: partidosManana.length,

      cantidadTotal: partidos.length,

      enVivo,

      partidosHoy,

      partidosManana,

      partidos,

      // Información para depuración
      api: {
        liveErrors: datosVivo.errors || {},
        hoyErrors: datosHoy.errors || {},
        mananaErrors: datosManana.errors || {},

        errores
      }

    });

  } catch (error) {

    console.error("ERROR API FOOTBALL:", error);

    return res.status(500).json({

      success: false,

      error: error.message || "Error interno del servidor"

    });

  }
}
