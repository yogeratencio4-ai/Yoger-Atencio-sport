export default async function handler(req, res) {
  try {
    const API_KEY = process.env.API_FOOTBALL_KEY;

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Falta API_FOOTBALL_KEY en Vercel"
      });
    }

    const {
      fixtureId,
      home = "",
      away = "",
      league = "",
      country = ""
    } = req.query;

    if (!fixtureId) {
      return res.status(400).json({
        success: false,
        error: "Falta fixtureId"
      });
    }

    const url =
      `https://v3.football.api-sports.io/predictions?fixture=${encodeURIComponent(
        fixtureId
      )}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": API_KEY
      }
    });

    const data = await response.json();

    // Error de API-Football
    if (!response.ok || data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({
        success: false,
        disponible: false,
        error: data.errors || "Error consultando API-Football",
        fixture: fixtureId
      });
    }

    if (!data.response || !data.response.length) {
      return res.status(200).json({
        success: true,
        disponible: false,
        fixture: fixtureId,
        partido: {
          local: home,
          visitante: away
        },
        liga: league,
        pais: country,
        mensaje: "No hay predicción disponible para este partido"
      });
    }

    const item = data.response[0];

    const prediction = item.predictions || {};

    // ---------------------------------------------------------
    // 1X2
    // ---------------------------------------------------------

    const percent = prediction.percent || {};

    const local =
      convertirNumero(percent.home);

    const empate =
      convertirNumero(percent.draw);

    const visitante =
      convertirNumero(percent.away);

    // ---------------------------------------------------------
    // GANADOR
    // ---------------------------------------------------------

    const winnerName =
      prediction.winner?.name ||
      prediction.winner?.name ||
      null;

    const winnerComment =
      prediction.winner?.comment ||
      null;

    // ---------------------------------------------------------
    // UNDER / OVER
    // ---------------------------------------------------------

    const underOver =
      prediction.under_over ||
      prediction.underOver ||
      null;

    // ---------------------------------------------------------
    // GOLES
    // ---------------------------------------------------------

    const goalsHome =
      prediction.goals?.home ??
      prediction.goals?.local ??
      null;

    const goalsAway =
      prediction.goals?.away ??
      prediction.goals?.visitante ??
      null;

    // ---------------------------------------------------------
    // CONSEJO
    // ---------------------------------------------------------

    const advice =
      prediction.advice ||
      null;

    // ---------------------------------------------------------
    // WIN OR DRAW
    // ---------------------------------------------------------

    const winOrDraw =
      prediction.win_or_draw ??
      prediction.winOrDraw ??
      null;

    // ---------------------------------------------------------
    // EXTRACCIÓN DE PORCENTAJES
    //
    // Algunas respuestas pueden traer información adicional
    // dentro de comparison. La guardamos para poder utilizarla.
    // ---------------------------------------------------------

    const comparison =
      item.comparison || {};

    // ---------------------------------------------------------
    // RESPUESTA
    // ---------------------------------------------------------

    return res.status(200).json({
      success: true,
      disponible: true,

      fixture: fixtureId,

      partido: {
        local:
          item.teams?.home?.name ||
          home,

        visitante:
          item.teams?.away?.name ||
          away
      },

      liga:
        item.league?.name ||
        league,

      pais:
        item.league?.country ||
        country,

      predictions: {

        // 1X2
        unoXdos: {
          local: local,
          empate: empate,
          visitante: visitante
        },

        // BTTS
        btts: {
          si: null,
          no: null
        },

        // Más/Menos goles
        underOver: underOver,

        // Goles estimados
        goles: {
          local: goalsHome,
          visitante: goalsAway
        },

        // Ganador
        winner: {
          name: winnerName,
          comment: winnerComment
        },

        // Consejo
        advice: advice,

        // Doble oportunidad
        winOrDraw: winOrDraw,

        // Datos adicionales disponibles
        comparison: comparison
      },

      fuente: "API-Football",

      estado: "prediccion_api_football"
    });

  } catch (error) {

    console.error("ERROR PREDICTIONS:", error);

    return res.status(500).json({
      success: false,
      disponible: false,
      error: error.message || "Error interno"
    });
  }
}


// ============================================================
// CONVERTIR PORCENTAJES
// ============================================================

function convertirNumero(valor) {

  if (valor === null || valor === undefined) {
    return null;
  }

  if (typeof valor === "number") {
    return valor;
  }

  if (typeof valor === "string") {

    const limpio = valor
      .replace("%", "")
      .replace(",", ".")
      .trim();

    const numero = parseFloat(limpio);

    return Number.isFinite(numero)
      ? numero
      : null;
  }

  return null;
}
