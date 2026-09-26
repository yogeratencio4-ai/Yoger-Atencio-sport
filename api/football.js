export default async function handler(request, response) {
  const API_KEY = process.env.API_FOOTBALL_KEY;

  if (!API_KEY) {
    return response.status(500).json({
      success: false,
      error: "Falta API_FOOTBALL_KEY en Vercel"
    });
  }

  const baseURL = "https://v3.football.api-sports.io";
  const headers = {
    "x-apisports-key": API_KEY
  };

  try {
    /*
     * =========================================================
     * PREDICCIÓN DE UN PARTIDO
     * /api/football?prediction=ID
     * =========================================================
     */

    if (request.query.prediction) {
      const fixtureId = request.query.prediction;

      const url =
        `${baseURL}/predictions?fixture=${encodeURIComponent(fixtureId)}`;

      const apiResponse = await fetch(url, {
        method: "GET",
        headers
      });

      const data = await apiResponse.json();

      /*
       * API-Football devuelve normalmente:
       *
       * {
       *   response: [
       *     {
       *       predictions: {
       *         winner: {...},
       *         under_over: "...",
       *         advice: "...",
       *         percent: {
       *           home: "...",
       *           draw: "...",
       *           away: "..."
       *         }
       *       }
       *     }
       *   ]
       * }
       */

      if (!apiResponse.ok) {
        return response.status(apiResponse.status).json({
          success: false,
          tipo: "prediction",
          fixture: fixtureId,
          error: data?.errors || "Error consultando predicción"
        });
      }

      if (data?.errors && Object.keys(data.errors).length > 0) {
        return response.status(200).json({
          success: false,
          tipo: "prediction",
          fixture: fixtureId,
          error: data.errors
        });
      }

      const resultado = data?.response?.[0];

      if (!resultado) {
        return response.status(200).json({
          success: true,
          tipo: "prediction",
          fixture: fixtureId,
          disponible: false,
          predictions: null
        });
      }

      const pred = resultado.predictions || {};

      /*
       * Porcentajes 1X2
       */
      const percent = pred.percent || {};

      const local =
        percent.home ??
        null;

      const empate =
        percent.draw ??
        null;

      const visitante =
        percent.away ??
        null;

      /*
       * BTTS
       *
       * API-Football puede devolver:
       * btts: {
       *   yes: "XX%",
       *   no: "XX%"
       * }
       */

      const btts =
        pred.btts?.yes ??
        null;

      /*
       * Predicción de goles.
       *
       * IMPORTANTE:
       * API-Football proporciona "under_over"
       * como predicción de línea, por ejemplo:
       * "Over 2.5"
       *
       * No vamos a inventar un porcentaje
       * para Over 1.5 o Under 3.5.
       */

      const underOver =
        pred.under_over ??
        null;

      /*
       * Ganador
       */

      let ganador = null;

      if (pred.winner) {
        ganador =
          pred.winner.name ??
          null;
      }

      /*
       * Consejo de la API
       */

      const consejo =
        pred.advice ??
        null;

      /*
       * Resultado NORMALIZADO para nuestro index.html
       */

      return response.status(200).json({
        success: true,
        tipo: "prediction",
        fixture: fixtureId,
        disponible: true,

        predictions: {
          percent: {
            home: local,
            draw: empate,
            away: visitante
          },

          btts: {
            yes: btts,
            no: pred.btts?.no ?? null
          },

          under_over: underOver,

          winner: {
            name: ganador
          },

          advice: consejo,

          goals: {
            home: pred.goals?.home ?? null,
            away: pred.goals?.away ?? null
          },

          win_or_draw:
            pred.win_or_draw ??
            null
        }
      });
    }


    /*
     * =========================================================
     * CONSULTA DIRECTA POR FIXTURE
     * /api/football?fixture=ID
     * =========================================================
     */

    if (request.query.fixture) {
      const fixtureId = request.query.fixture;

      const url =
        `${baseURL}/fixtures?id=${encodeURIComponent(fixtureId)}`;

      const apiResponse = await fetch(url, {
        method: "GET",
        headers
      });

      const data = await apiResponse.json();

      return response.status(apiResponse.status).json(data);
    }


    /*
     * =========================================================
     * PARTIDOS
     * =========================================================
     */

    const ahora = new Date();

    /*
     * Usamos fecha UTC para mantener compatibilidad
     * con la API.
     */

    const fechaHoy =
      ahora.toISOString().slice(0, 10);

    const mananaDate =
      new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

    const fechaManana =
      mananaDate.toISOString().slice(0, 10);


    /*
     * =========================================================
     * LLAMADAS A API-FOOTBALL
     * =========================================================
     */

    const urlLive =
      `${baseURL}/fixtures?live=all`;

    const urlHoy =
      `${baseURL}/fixtures?date=${fechaHoy}`;

    const urlManana =
      `${baseURL}/fixtures?date=${fechaManana}`;


    const [liveResult, hoyResult, mananaResult] =
      await Promise.all([
        fetch(urlLive, {
          method: "GET",
          headers
        }),

        fetch(urlHoy, {
          method: "GET",
          headers
        }),

        fetch(urlManana, {
          method: "GET",
          headers
        })
      ]);


    /*
     * Convertimos respuestas a JSON
     */

    const liveData =
      await liveResult.json();

    const hoyData =
      await hoyResult.json();

    const mananaData =
      await mananaResult.json();


    /*
     * =========================================================
     * ERRORES
     * =========================================================
     */

    const errores = {
      live: liveData?.errors || null,
      hoy: hoyData?.errors || null,
      manana: mananaData?.errors || null
    };


    /*
     * =========================================================
     * ARRAYS
     * =========================================================
     */

    const enVivo =
      Array.isArray(liveData?.response)
        ? liveData.response
        : [];

    const partidosHoy =
      Array.isArray(hoyData?.response)
        ? hoyData.response
        : [];

    const partidosManana =
      Array.isArray(mananaData?.response)
        ? mananaData.response
        : [];


    /*
     * =========================================================
     * ELIMINAR DUPLICADOS
     * =========================================================
     */

    const mapa =
      new Map();

    [
      ...enVivo,
      ...partidosHoy,
      ...partidosManana
    ].forEach(partido => {

      if (
        partido?.fixture?.id !== undefined &&
        partido?.fixture?.id !== null
      ) {
        mapa.set(
          partido.fixture.id,
          partido
        );
      }

    });


    const partidos =
      Array.from(mapa.values());


    /*
     * =========================================================
     * RESPUESTA FINAL
     * =========================================================
     */

    return response.status(200).json({

      success: true,

      fechaActual:
        ahora.toISOString(),

      hoy:
        fechaHoy,

      manana:
        fechaManana,

      cantidadEnVivo:
        enVivo.length,

      cantidadHoy:
        partidosHoy.length,

      cantidadManana:
        partidosManana.length,

      cantidadTotal:
        partidos.length,

      enVivo,

      partidosHoy,

      partidosManana,

      partidos,

      api: {
        liveErrors:
          errores.live,

        hoyErrors:
          errores.hoy,

        mananaErrors:
          errores.manana
      }

    });

  } catch (error) {

    console.error(
      "ERROR API FOOTBALL:",
      error
    );

    return response.status(500).json({

      success: false,

      error:
        error?.message ||
        "Error interno del servidor"

    });

  }
}
