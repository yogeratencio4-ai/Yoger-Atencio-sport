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

    const {
      fixtureId,
      home,
      away,
      league,
      country
    } = request.query;

    /*
     * =====================================================
     * NECESITAMOS EL ID DEL PARTIDO
     * =====================================================
     */

    if (!fixtureId) {

      return response.status(400).json({
        success: false,
        error: "Falta fixtureId"
      });

    }

    /*
     * =====================================================
     * CONSULTAR PREDICCIÓN DE API-FOOTBALL
     * =====================================================
     */

    const url =
      `${baseURL}/predictions?fixture=${encodeURIComponent(fixtureId)}`;

    const apiResponse =
      await fetch(url, {
        method: "GET",
        headers
      });

    const data =
      await apiResponse.json();

    /*
     * =====================================================
     * ERROR DE API
     * =====================================================
     */

    if (!apiResponse.ok) {

      return response.status(apiResponse.status).json({

        success: false,

        fixture: fixtureId,

        partido: {
          local: home || null,
          visitante: away || null
        },

        error:
          data?.errors ||
          "Error consultando predicción"

      });

    }

    /*
     * =====================================================
     * ERRORES DEVUELTOS POR API-FOOTBALL
     * =====================================================
     */

    if (
      data?.errors &&
      Object.keys(data.errors).length > 0
    ) {

      return response.status(200).json({

        success: false,

        disponible: false,

        fixture: fixtureId,

        partido: {
          local: home || null,
          visitante: away || null
        },

        error: data.errors

      });

    }

    /*
     * =====================================================
     * RESULTADO
     * =====================================================
     */

    const resultado =
      data?.response?.[0];

    if (!resultado) {

      return response.status(200).json({

        success: true,

        disponible: false,

        fixture: fixtureId,

        partido: {
          local: home || null,
          visitante: away || null
        },

        predictions: null,

        mensaje:
          "API-Football no tiene predicción disponible para este partido."

      });

    }

    const pred =
      resultado.predictions || {};

    const percent =
      pred.percent || {};

    /*
     * =====================================================
     * 1X2
     * =====================================================
     */

    const local =
      percent.home ?? null;

    const empate =
      percent.draw ?? null;

    const visitante =
      percent.away ?? null;

    /*
     * =====================================================
     * BTTS
     * =====================================================
     */

    const bttsSi =
      pred.btts?.yes ?? null;

    const bttsNo =
      pred.btts?.no ?? null;

    /*
     * =====================================================
     * UNDER / OVER
     * =====================================================
     */

    const underOver =
      pred.under_over ?? null;

    /*
     * =====================================================
     * GANADOR
     * =====================================================
     */

    let ganador = null;

    if (pred.winner) {

      ganador =
        pred.winner.name ?? null;

    }

    /*
     * =====================================================
     * CONSEJO
     * =====================================================
     */

    const consejo =
      pred.advice ?? null;

    /*
     * =====================================================
     * GOLES ESPERADOS
     * =====================================================
     */

    const golesLocal =
      pred.goals?.home ?? null;

    const golesVisitante =
      pred.goals?.away ?? null;

    /*
     * =====================================================
     * DOBLE OPORTUNIDAD
     * =====================================================
     */

    const dobleOportunidad =
      pred.win_or_draw ?? null;

    /*
     * =====================================================
     * RESPUESTA PARA YOGER ATENCIO SPORT
     * =====================================================
     */

    return response.status(200).json({

      success: true,

      disponible: true,

      fixture: fixtureId,

      partido: {

        local:
          home || resultado.teams?.home?.name || null,

        visitante:
          away || resultado.teams?.away?.name || null

      },

      liga:
        league || null,

      pais:
        country || null,

      predictions: {

        unoXdos: {

          local,
          empate,
          visitante

        },

        btts: {

          si: bttsSi,
          no: bttsNo

        },

        underOver,

        winner: {

          name:
            ganador

        },

        advice:
          consejo,

        goles: {

          local:
            golesLocal,

          visitante:
            golesVisitante

        },

        winOrDraw:
          dobleOportunidad

      },

      fuente: "API-Football",

      estado:
        "prediccion_api_football"

    });

  } catch (error) {

    console.error(
      "ERROR PREDICTIONS:",
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
