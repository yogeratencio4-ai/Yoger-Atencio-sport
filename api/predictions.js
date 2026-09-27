export default async function handler(req, res) {
  try {
    const API_KEY = process.env.API_FOOTBALL_KEY;

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Falta API_FOOTBALL_KEY"
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

    const headers = {
      "x-apisports-key": API_KEY
    };

    /*
     * CONSULTAMOS:
     *
     * 1. Predictions
     * 2. Odds
     *
     * Se hacen al mismo tiempo para ahorrar tiempo.
     */

    const [predRes, oddsRes] = await Promise.all([
      fetch(
        `https://v3.football.api-sports.io/predictions?fixture=${encodeURIComponent(
          fixtureId
        )}`,
        { headers }
      ),

      fetch(
        `https://v3.football.api-sports.io/odds?fixture=${encodeURIComponent(
          fixtureId
        )}`,
        { headers }
      )
    ]);

    const predData = await predRes.json();
    const oddsData = await oddsRes.json();

    /*
     * ==========================================================
     * PREDICTIONS
     * ==========================================================
     */

    let prediction = {};

    if (
      predData &&
      Array.isArray(predData.response) &&
      predData.response.length
    ) {
      prediction = predData.response[0].predictions || {};
    }

    /*
     * ==========================================================
     * 1X2
     * ==========================================================
     */

    const percent = prediction.percent || {};

    const unoXdos = {
      local: numero(percent.home),
      empate: numero(percent.draw),
      visitante: numero(percent.away)
    };

    /*
     * ==========================================================
     * GANADOR
     * ==========================================================
     */

    const winner = {
      name: prediction.winner?.name || null,
      comment: prediction.winner?.comment || null
    };

    /*
     * ==========================================================
     * UNDER / OVER DE API
     * ==========================================================
     */

    const underOver =
      prediction.under_over ||
      prediction.underOver ||
      null;

    /*
     * ==========================================================
     * GOLES ESTIMADOS
     * ==========================================================
     */

    const golesEstimados = {
      local:
        numero(prediction.goals?.home) ??
        numero(prediction.goals?.local),

      visitante:
        numero(prediction.goals?.away) ??
        numero(prediction.goals?.visitante)
    };

    /*
     * ==========================================================
     * ODDS
     * ==========================================================
     */

    const mercados = extraerMercadosOdds(oddsData);

    /*
     * ==========================================================
     * CALCULAMOS MERCADOS
     * ==========================================================
     *
     * Si encontramos cuotas para:
     *
     * BTTS
     * Over/Under goles
     * corners
     * tarjetas
     *
     * convertimos las cuotas en probabilidad implícita
     * normalizada.
     */

    const btts = buscarMercado(
      mercados,
      [
        "both teams to score",
        "btts"
      ]
    );

    const goles15 = buscarMercado(
      mercados,
      [
        "over 1.5 goals",
        "over 1.5"
      ]
    );

    const goles35 = buscarMercado(
      mercados,
      [
        "under 3.5 goals",
        "under 3.5"
      ]
    );

    const corners65 = buscarMercado(
      mercados,
      [
        "over 6.5 corners",
        "over 6.5"
      ]
    );

    const corners115 = buscarMercado(
      mercados,
      [
        "under 11.5 corners",
        "under 11.5"
      ]
    );

    const tarjetas35 = buscarMercado(
      mercados,
      [
        "over 3.5 cards",
        "over 3.5"
      ]
    );

    const tarjetas55 = buscarMercado(
      mercados,
      [
        "under 5.5 cards",
        "under 5.5"
      ]
    );

    /*
     * ==========================================================
     * RESPUESTA FINAL
     * ==========================================================
     */

    return res.status(200).json({
      success: true,

      disponible:
        Object.keys(prediction).length > 0 ||
        mercados.length > 0,

      fixture: fixtureId,

      partido: {
        local:
          prediction.teams?.home?.name ||
          home,

        visitante:
          prediction.teams?.away?.name ||
          away
      },

      liga: league,
      pais: country,

      predictions: {

        /*
         * 1X2
         */

        unoXdos,

        /*
         * BTTS
         */

        btts: {
          si: btts?.yes ?? null,
          no: btts?.no ?? null
        },

        /*
         * GOLES
         */

        goles: {
          mas15:
            goles15?.yes ??
            calcularOverDesdePrediccion(
              underOver,
              1.5
            ),

          menos35:
            goles35?.yes ??
            calcularUnderDesdePrediccion(
              underOver,
              3.5
            ),

          local: golesEstimados.local,
          visitante: golesEstimados.visitante
        },

        /*
         * UNDER / OVER ORIGINAL
         */

        underOver,

        /*
         * CÓRNERS
         */

        corners: {
          mas65: corners65?.yes ?? null,
          menos115: corners115?.yes ?? null
        },

        /*
         * TARJETAS
         */

        tarjetas: {
          mas35: tarjetas35?.yes ?? null,
          menos55: tarjetas55?.yes ?? null
        },

        /*
         * GANADOR
         */

        winner,

        /*
         * CONSEJO
         */

        advice:
          prediction.advice ||
          null,

        /*
         * DOBLE OPORTUNIDAD
         */

        winOrDraw:
          prediction.win_or_draw ??
          prediction.winOrDraw ??
          null,

        /*
         * OTROS MERCADOS ENCONTRADOS
         */

        otros: mercados
      },

      fuente: "API-Football",

      estado: "analisis_completo"
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


/*
 * ============================================================
 * CONVERTIR A NÚMERO
 * ============================================================
 */

function numero(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  if (typeof valor === "string") {
    const limpio = valor
      .replace("%", "")
      .replace(",", ".")
      .trim();

    const n = parseFloat(limpio);

    return Number.isFinite(n) ? n : null;
  }

  return null;
}


/*
 * ============================================================
 * EXTRAER MERCADOS DE ODDS
 * ============================================================
 */

function extraerMercadosOdds(data) {
  const resultado = [];

  if (!data || !Array.isArray(data.response)) {
    return resultado;
  }

  for (const bloque of data.response) {

    const bookmakers = bloque.bookmakers || [];

    for (const bookmaker of bookmakers) {

      const bets = bookmaker.bets || [];

      for (const bet of bets) {

        const nombreMercado =
          String(bet.name || "").trim();

        const values = bet.values || [];

        for (const value of values) {

          const nombre =
            String(value.value || "").trim();

          const cuota =
            numero(value.odd);

          if (!nombre || cuota === null) {
            continue;
          }

          resultado.push({
            bookmaker:
              bookmaker.name || null,

            mercado:
              nombreMercado,

            opcion:
              nombre,

            cuota
          });
        }
      }
    }
  }

  return resultado;
}


/*
 * ============================================================
 * BUSCAR MERCADO
 * ============================================================
 */

function buscarMercado(mercados, nombres) {

  const encontrados = [];

  for (const mercado of mercados) {

    const texto =
      `${mercado.mercado} ${mercado.opcion}`
        .toLowerCase();

    const coincide =
      nombres.some(nombre =>
        texto.includes(nombre.toLowerCase())
      );

    if (coincide) {
      encontrados.push(mercado);
    }
  }

  if (!encontrados.length) {
    return null;
  }

  let yes = null;
  let no = null;

  for (const item of encontrados) {

    const opcion =
      item.opcion.toLowerCase();

    const prob =
      probabilidadImplicita(
        item.cuota
      );

    if (
      opcion === "yes" ||
      opcion === "sí" ||
      opcion === "si" ||
      opcion.includes("over")
    ) {
      yes = prob;
    }

    if (
      opcion === "no" ||
      opcion.includes("under")
    ) {
      no = prob;
    }
  }

  /*
   * Si tenemos dos opciones,
   * normalizamos para que sumen 100%.
   */

  if (yes !== null && no !== null) {

    const total = yes + no;

    if (total > 0) {
      yes = redondear(
        (yes / total) * 100
      );

      no = redondear(
        (no / total) * 100
      );
    }
  }

  return {
    yes,
    no
  };
}


/*
 * ============================================================
 * PROBABILIDAD IMPLÍCITA
 * ============================================================
 */

function probabilidadImplicita(cuota) {

  if (
    cuota === null ||
    cuota <= 0
  ) {
    return null;
  }

  return 1 / cuota;
}


/*
 * ============================================================
 * UNDER/OVER DE API-FOOTBALL
 * ============================================================
 *
 * IMPORTANTE:
 * API-Football entrega normalmente algo como:
 *
 * "Over 2.5"
 * "Under 2.5"
 *
 * Eso NO permite conocer matemáticamente el porcentaje
 * exacto de Over 1.5 o Under 3.5.
 *
 * Por eso aquí NO inventamos esos porcentajes.
 */

function calcularOverDesdePrediccion(
  valor,
  linea
) {
  return null;
}

function calcularUnderDesdePrediccion(
  valor,
  linea
) {
  return null;
}


/*
 * ============================================================
 * REDONDEAR
 * ============================================================
 */

function redondear(valor) {

  if (
    valor === null ||
    !Number.isFinite(valor)
  ) {
    return null;
  }

  return Math.round(
    valor * 10
  ) / 10;
}
