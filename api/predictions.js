export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  const API_KEY = process.env.API_FOOTBALL_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      success: false,
      error: "Falta API_FOOTBALL_KEY en Vercel"
    });
  }

  const fixtureId =
    req.query.fixtureId ||
    req.query.fixture ||
    req.query.id;

  const homeQuery = req.query.home || "";
  const awayQuery = req.query.away || "";
  const leagueQuery = req.query.league || "";
  const countryQuery = req.query.country || "";

  if (!fixtureId) {
    return res.status(400).json({
      success: false,
      error: "Falta fixtureId"
    });
  }

  const BASE = "https://v3.football.api-sports.io";

  const headers = {
    "x-apisports-key": API_KEY
  };

  try {
    /*
      ============================================================
      1. PEDIMOS PREDICCIONES + CUOTAS EN PARALELO
      ============================================================
    */

    const [predictionResponse, oddsResponse] = await Promise.all([
      fetch(
        `${BASE}/predictions?fixture=${encodeURIComponent(fixtureId)}`,
        { headers }
      ),

      fetch(
        `${BASE}/odds?fixture=${encodeURIComponent(fixtureId)}`,
        { headers }
      )
    ]);

    const predictionData = await predictionResponse.json();
    const oddsData = await oddsResponse.json();

    /*
      ============================================================
      2. COMPROBAR ERRORES DE API
      ============================================================
    */

    const predictionErrors = predictionData?.errors || [];
    const oddsErrors = oddsData?.errors || [];

    const prediction =
      predictionData?.response?.[0] ||
      predictionData?.response ||
      null;

    /*
      ============================================================
      3. INFORMACIÓN DEL PARTIDO
      ============================================================
    */

    const fixtureInfo = prediction?.fixture || {};
    const teams = prediction?.teams || {};
    const league = prediction?.league || {};

    const local =
      teams?.home?.name ||
      homeQuery ||
      "Local";

    const visitante =
      teams?.away?.name ||
      awayQuery ||
      "Visitante";

    const liga =
      league?.name ||
      leagueQuery ||
      "";

    const pais =
      league?.country ||
      countryQuery ||
      "";

    /*
      ============================================================
      4. FUNCIONES AUXILIARES
      ============================================================
    */

    function numero(valor) {
      if (valor === null || valor === undefined) return null;

      if (typeof valor === "number") {
        return Number.isFinite(valor) ? valor : null;
      }

      const limpio = String(valor)
        .replace("%", "")
        .replace(",", ".")
        .trim();

      const n = Number(limpio);

      return Number.isFinite(n) ? n : null;
    }

    function porcentaje(valor) {
      const n = numero(valor);

      if (n === null) return null;

      return Math.max(0, Math.min(100, Number(n.toFixed(1))));
    }

    function limpiarNombre(valor) {
      if (!valor) return "";

      return String(valor)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    }

    /*
      ============================================================
      5. 1X2 DE API-FOOTBALL
      ============================================================
    */

    const percent = prediction?.predictions?.percent || {};

    const unoXdos = {
      local: porcentaje(percent.home),
      empate: porcentaje(percent.draw),
      visitante: porcentaje(percent.away)
    };

    /*
      ============================================================
      6. GANADOR / CONSEJO / OVER UNDER
      ============================================================
    */

    const ganador =
      prediction?.predictions?.winner?.name ||
      null;

    const consejo =
      prediction?.predictions?.advice ||
      null;

    const underOver =
      prediction?.predictions?.under_over ||
      null;

    const winOrDraw =
      prediction?.predictions?.win_or_draw ??
      null;

    /*
      ============================================================
      7. GOLES ESTIMADOS
      ============================================================
    */

    const golesAPI =
      prediction?.predictions?.goals || {};

    const golesLocal =
      numero(golesAPI.home);

    const golesVisitante =
      numero(golesAPI.away);

    /*
      ============================================================
      8. MODELO POISSON
         Usamos los goles estimados de API-Football para calcular:

         - Más 1.5
         - Menos 3.5
         - BTTS
      ============================================================
    */

    function factorial(n) {
      if (n <= 1) return 1;

      let resultado = 1;

      for (let i = 2; i <= n; i++) {
        resultado *= i;
      }

      return resultado;
    }

    function poisson(lambda, k) {
      if (
        lambda === null ||
        !Number.isFinite(lambda) ||
        lambda < 0
      ) {
        return null;
      }

      return (
        Math.exp(-lambda) *
        Math.pow(lambda, k) /
        factorial(k)
      );
    }

    function probabilidadTotalGoles(lambda, limite) {
      let suma = 0;

      for (let k = 0; k <= limite; k++) {
        const p = poisson(lambda, k);

        if (p !== null) {
          suma += p;
        }
      }

      return suma;
    }

    let goles = {
      mas15: null,
      menos35: null
    };

    let btts = {
      si: null,
      no: null
    };

    if (
      golesLocal !== null &&
      golesVisitante !== null
    ) {
      const lambdaLocal = Math.max(0, golesLocal);
      const lambdaVisitante = Math.max(0, golesVisitante);

      const lambdaTotal =
        lambdaLocal +
        lambdaVisitante;

      /*
        P(0 goles)
      */
      const p0 =
        poisson(lambdaTotal, 0);

      /*
        P(1 gol)
      */
      const p1 =
        poisson(lambdaTotal, 1);

      /*
        Más de 1.5 = 1 - P(0) - P(1)
      */
      const over15 =
        1 - p0 - p1;

      /*
        Menos de 3.5 = P(0)+P(1)+P(2)+P(3)
      */
      const under35 =
        probabilidadTotalGoles(
          lambdaTotal,
          3
        );

      /*
        BTTS:
        1 - que local marque 0
          - que visitante marque 0
          + que ambos marquen 0
      */
      const localCero =
        poisson(lambdaLocal, 0);

      const visitanteCero =
        poisson(lambdaVisitante, 0);

      const ambosCero =
        localCero *
        visitanteCero;

      const bttsSi =
        1 -
        localCero -
        visitanteCero +
        ambosCero;

      goles = {
        mas15: porcentaje(over15 * 100),
        menos35: porcentaje(under35 * 100)
      };

      btts = {
        si: porcentaje(bttsSi * 100),
        no: porcentaje((1 - bttsSi) * 100)
      };
    }

    /*
      ============================================================
      9. PROCESAR ODDS
      ============================================================
    */

    const bookmakers =
      oddsData?.response?.[0]?.bookmakers ||
      [];

    /*
      Guardamos todos los mercados encontrados.
    */

    const mercados = [];

    for (const bookmaker of bookmakers) {
      const bets = bookmaker?.bets || [];

      for (const bet of bets) {
        mercados.push({
          bookmaker:
            bookmaker?.name || "",

          bet:
            bet?.name || "",

          values:
            bet?.values || []
        });
      }
    }

    /*
      ============================================================
      10. PROBABILIDAD IMPLÍCITA DE UNA CUOTA
      ============================================================
    */

    function probCuota(odd) {
      const cuota = numero(odd);

      if (
        cuota === null ||
        cuota <= 1
      ) {
        return null;
      }

      return 100 / cuota;
    }

    /*
      ============================================================
      11. BUSCAR MERCADO
      ============================================================
    */

    function encontrarMercado(patrones) {
      for (const mercado of mercados) {
        const nombre =
          limpiarNombre(mercado.bet);

        const coincide =
          patrones.some((patron) =>
            nombre.includes(
              limpiarNombre(patron)
            )
          );

        if (coincide) {
          return mercado;
        }
      }

      return null;
    }

    /*
      ============================================================
      12. BUSCAR VALOR DENTRO DE UN MERCADO
      ============================================================
    */

    function buscarValor(
      mercado,
      patrones
    ) {
      if (!mercado?.values) {
        return null;
      }

      for (const item of mercado.values) {
        const value =
          limpiarNombre(item?.value);

        const coincide =
          patrones.some((patron) =>
            value.includes(
              limpiarNombre(patron)
            )
          );

        if (coincide) {
          return item;
        }
      }

      return null;
    }

    /*
      ============================================================
      13. BTTS DESDE ODDS
      ============================================================
    */

    const mercadoBTTS =
      encontrarMercado([
        "both teams to score",
        "btts"
      ]);

    if (mercadoBTTS) {
      const si =
        buscarValor(
          mercadoBTTS,
          ["yes", "si"]
        );

      const no =
        buscarValor(
          mercadoBTTS,
          ["no"]
        );

      const pSi =
        probCuota(si?.odd);

      const pNo =
        probCuota(no?.odd);

      if (
        pSi !== null ||
        pNo !== null
      ) {
        const total =
          (pSi || 0) +
          (pNo || 0);

        if (total > 0) {
          btts = {
            si: porcentaje(
              (pSi / total) * 100
            ),
            no: porcentaje(
              (pNo / total) * 100
            )
          };
        }
      }
    }

    /*
      ============================================================
      14. BUSCAR OVER / UNDER 1.5
      ============================================================
    */

    function obtenerOverUnder(
      nombresMercado,
      overPatrones,
      underPatrones
    ) {
      const mercado =
        encontrarMercado(nombresMercado);

      if (!mercado) {
        return null;
      }

      const over =
        buscarValor(
          mercado,
          overPatrones
        );

      const under =
        buscarValor(
          mercado,
          underPatrones
        );

      const pOver =
        probCuota(over?.odd);

      const pUnder =
        probCuota(under?.odd);

      if (
        pOver === null &&
        pUnder === null
      ) {
        return null;
      }

      const total =
        (pOver || 0) +
        (pUnder || 0);

      if (total <= 0) {
        return null;
      }

      return {
        over: porcentaje(
          (pOver / total) * 100
        ),
        under: porcentaje(
          (pUnder / total) * 100
        )
      };
    }

    /*
      ============================================================
      15. INTENTAR ENCONTRAR O1.5
      ============================================================
    */

    const goles15Odds =
      obtenerOverUnder(
        [
          "goals over under",
          "over under"
        ],
        [
          "over 1.5"
        ],
        [
          "under 1.5"
        ]
      );

    if (goles15Odds) {
      goles.mas15 =
        goles15Odds.over;
    }

    /*
      ============================================================
      16. INTENTAR ENCONTRAR U3.5
      ============================================================
    */

    const goles35Odds =
      obtenerOverUnder(
        [
          "goals over under",
          "over under"
        ],
        [
          "over 3.5"
        ],
        [
          "under 3.5"
        ]
      );

    if (goles35Odds) {
      goles.menos35 =
        goles35Odds.under;
    }

    /*
      ============================================================
      17. CORNERS
      ============================================================
    */

    const mercadoCorners =
      encontrarMercado([
        "corners over under",
        "corner over under",
        "total corners",
        "corners"
      ]);

    let corners = {
      mas65: null,
      menos115: null
    };

    if (mercadoCorners) {
      const over65 =
        buscarValor(
          mercadoCorners,
          [
            "over 6.5",
            "over 6",
            "+6.5"
          ]
        );

      const under115 =
        buscarValor(
          mercadoCorners,
          [
            "under 11.5",
            "under 11",
            "-11.5"
          ]
        );

      const pOver65 =
        probCuota(over65?.odd);

      const pUnder115 =
        probCuota(under115?.odd);

      corners = {
        mas65:
          pOver65 !== null
            ? porcentaje(pOver65)
            : null,

        menos115:
          pUnder115 !== null
            ? porcentaje(pUnder115)
            : null
      };
    }

    /*
      ============================================================
      18. TARJETAS
      ============================================================
    */

    const mercadoTarjetas =
      encontrarMercado([
        "cards over under",
        "total cards",
        "cards"
      ]);

    let tarjetas = {
      mas35: null,
      menos55: null
    };

    if (mercadoTarjetas) {
      const over35 =
        buscarValor(
          mercadoTarjetas,
          [
            "over 3.5",
            "over 3",
            "+3.5"
          ]
        );

      const under55 =
        buscarValor(
          mercadoTarjetas,
          [
            "under 5.5",
            "under 5",
            "-5.5"
          ]
        );

      const pOver35 =
        probCuota(over35?.odd);

      const pUnder55 =
        probCuota(under55?.odd);

      tarjetas = {
        mas35:
          pOver35 !== null
            ? porcentaje(pOver35)
            : null,

        menos55:
          pUnder55 !== null
            ? porcentaje(pUnder55)
            : null
      };
    }

    /*
      ============================================================
      19. OTROS MERCADOS
      ============================================================
    */

    const otros = [];

    if (winOrDraw !== null) {
      otros.push({
        mercado: "Doble oportunidad",
        opcion: "1X",
        porcentaje:
          winOrDraw === true
            ? unoXdos.local !== null &&
              unoXdos.empate !== null
              ? porcentaje(
                  unoXdos.local +
                  unoXdos.empate
                )
              : null
            : null
      });
    }

    if (underOver) {
      otros.push({
        mercado: "Predicción goles API",
        opcion: underOver,
        porcentaje: null
      });
    }

    /*
      ============================================================
      20. ESTADO GENERAL
      ============================================================
    */

    const tienePrediccion =
      prediction !== null;

    const tieneOdds =
      mercados.length > 0;

    /*
      ============================================================
      21. RESPUESTA FINAL
      ============================================================
    */

    return res.status(200).json({
      success: true,

      disponible:
        tienePrediccion ||
        tieneOdds,

      fixture: fixtureId,

      partido: {
        local,
        visitante
      },

      liga,
      pais,

      predictions: {
        unoXdos,

        goles,

        btts,

        corners,

        tarjetas,

        winner: {
          nombre: ganador
        },

        advice: consejo,

        underOver,

        winOrDraw,

        golesEstimados: {
          local: golesLocal,
          visitante: golesVisitante
        },

        otros
      },

      fuente: {
        prediccion: "API-Football",
        mercados: tieneOdds
          ? "Cuotas disponibles en API-Football"
          : null
      },

      metodologia: {
        unoXdos:
          "Probabilidades proporcionadas por API-Football",

        goles:
          "Probabilidad de cuotas cuando existe el mercado; si no, modelo Poisson usando los goles estimados por API-Football",

        btts:
          "Probabilidad de cuotas cuando existe el mercado; si no, modelo Poisson usando los goles estimados por API-Football",

        corners:
          "Probabilidad implícita de cuotas cuando API-Football publica el mercado",

        tarjetas:
          "Probabilidad implícita de cuotas cuando API-Football publica el mercado"
      },

      estado:
        tienePrediccion
          ? "prediccion_api_football"
          : tieneOdds
            ? "odds_disponibles"
            : "sin_datos",

      errores: {
        predictions:
          predictionErrors,

        odds:
          oddsErrors
      }
    });

  } catch (error) {
    console.error("ERROR PREDICCIONES:", error);

    return res.status(500).json({
      success: false,
      error: "Error consultando API-Football",
      detalle: error.message
    });
  }
  }
