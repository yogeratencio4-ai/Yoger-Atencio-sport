export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Cache-Control",
    "s-maxage=300, stale-while-revalidate=600"
  );

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
    PREDICCIONES + CUOTAS
    ============================================================
    */

    const [predictionResponse, oddsResponse] =
      await Promise.all([
        fetch(
          `${BASE}/predictions?fixture=${encodeURIComponent(
            fixtureId
          )}`,
          { headers }
        ),

        fetch(
          `${BASE}/odds?fixture=${encodeURIComponent(
            fixtureId
          )}`,
          { headers }
        )
      ]);

    const predictionData =
      await predictionResponse.json();

    const oddsData =
      await oddsResponse.json();

    const prediction =
      predictionData?.response?.[0] ||
      null;

    /*
    ============================================================
    FUNCIONES
    ============================================================
    */

    function numero(valor) {
      if (
        valor === null ||
        valor === undefined
      ) {
        return null;
      }

      const n = Number(
        String(valor)
          .replace("%", "")
          .replace(",", ".")
          .trim()
      );

      return Number.isFinite(n)
        ? n
        : null;
    }

    function porcentaje(valor) {
      const n = numero(valor);

      if (n === null) {
        return null;
      }

      return Number(
        Math.max(
          0,
          Math.min(100, n)
        ).toFixed(1)
      );
    }

    function normalizar(texto) {
      return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    }

    /*
    ============================================================
    INFORMACIÓN DEL PARTIDO
    ============================================================
    */

    const teams =
      prediction?.teams || {};

    const league =
      prediction?.league || {};

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
    1X2
    ============================================================
    */

    const percent =
      prediction?.predictions?.percent ||
      {};

    const unoXdos = {
      local: porcentaje(percent.home),
      empate: porcentaje(percent.draw),
      visitante: porcentaje(percent.away)
    };

    /*
    ============================================================
    GANADOR / CONSEJO / UNDER OVER
    ============================================================
    */

    const ganador =
      prediction?.predictions?.winner?.name ||
      null;

    const consejo =
      prediction?.predictions?.advice ||
      null;

    const underOverAPI =
      prediction?.predictions?.under_over ||
      null;

    /*
    ============================================================
    GOLES ESTIMADOS
    ============================================================
    */

    const golesAPI =
      prediction?.predictions?.goals ||
      {};

    const golesLocal =
      numero(golesAPI.home);

    const golesVisitante =
      numero(golesAPI.away);

    /*
    ============================================================
    POISSON
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
        !Number.isFinite(lambda)
      ) {
        return null;
      }

      return (
        Math.exp(-lambda) *
        Math.pow(lambda, k) /
        factorial(k)
      );
    }

    function probHasta(lambda, limite) {
      let total = 0;

      for (let i = 0; i <= limite; i++) {
        const p = poisson(lambda, i);

        if (p !== null) {
          total += p;
        }
      }

      return total;
    }

    /*
    ============================================================
    MERCADOS BASE
    ============================================================
    */

    let btts = {
      si: null,
      no: null
    };

    let goles = {
      mas25: null,
      menos45: null
    };

    /*
    ============================================================
    MODELO DE GOLES
    ============================================================
    */

    if (
      golesLocal !== null &&
      golesVisitante !== null
    ) {
      const lambdaLocal =
        Math.max(0, golesLocal);

      const lambdaVisitante =
        Math.max(0, golesVisitante);

      const lambdaTotal =
        lambdaLocal +
        lambdaVisitante;

      /*
      MÁS 2.5
      */

      const menos25 =
        probHasta(
          lambdaTotal,
          2
        );

      const mas25 =
        1 - menos25;

      /*
      MENOS 4.5
      */

      const menos45 =
        probHasta(
          lambdaTotal,
          4
        );

      goles = {
        mas25: porcentaje(
          mas25 * 100
        ),

        menos45: porcentaje(
          menos45 * 100
        )
      };

      /*
      BTTS
      */

      const localCero =
        poisson(
          lambdaLocal,
          0
        );

      const visitanteCero =
        poisson(
          lambdaVisitante,
          0
        );

      const ambosCero =
        localCero *
        visitanteCero;

      const bttsSi =
        1 -
        localCero -
        visitanteCero +
        ambosCero;

      btts = {
        si: porcentaje(
          bttsSi * 100
        ),

        no: porcentaje(
          (1 - bttsSi) * 100
        )
      };
    }

    /*
    ============================================================
    ODDS
    ============================================================
    */

    const bookmakers =
      oddsData?.response?.[0]?.bookmakers ||
      [];

    const mercados = [];

    for (const bookmaker of bookmakers) {
      for (const bet of bookmaker?.bets || []) {
        mercados.push({
          bookmaker:
            bookmaker?.name || "",

          nombre:
            bet?.name || "",

          values:
            bet?.values || []
        });
      }
    }

    /*
    ============================================================
    PROBABILIDAD DE CUOTA
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
    BUSCAR MERCADO
    ============================================================
    */

    function buscarMercado(patrones) {
      for (const mercado of mercados) {
        const nombre =
          normalizar(mercado.nombre);

        if (
          patrones.some(p =>
            nombre.includes(
              normalizar(p)
            )
          )
        ) {
          return mercado;
        }
      }

      return null;
    }

    /*
    ============================================================
    BUSCAR OPCIÓN
    ============================================================
    */

    function buscarOpcion(
      mercado,
      patrones
    ) {
      if (!mercado) {
        return null;
      }

      for (const item of mercado.values) {
        const valor =
          normalizar(item?.value);

        if (
          patrones.some(p =>
            valor.includes(
              normalizar(p)
            )
          )
        ) {
          return item;
        }
      }

      return null;
    }

    /*
    ============================================================
    CONVERTIR DOS CUOTAS A PORCENTAJES
    ============================================================
    */

    function dosProbabilidades(
      overItem,
      underItem
    ) {
      const p1 =
        probCuota(overItem?.odd);

      const p2 =
        probCuota(underItem?.odd);

      if (
        p1 === null &&
        p2 === null
      ) {
        return null;
      }

      const total =
        (p1 || 0) +
        (p2 || 0);

      if (total <= 0) {
        return null;
      }

      return {
        over: porcentaje(
          (p1 / total) * 100
        ),

        under: porcentaje(
          (p2 / total) * 100
        )
      };
    }

    /*
    ============================================================
    BTTS DESDE CUOTAS
    ============================================================
    */

    const mercadoBTTS =
      buscarMercado([
        "both teams to score",
        "btts"
      ]);

    if (mercadoBTTS) {
      const si =
        buscarOpcion(
          mercadoBTTS,
          ["yes", "si"]
        );

      const no =
        buscarOpcion(
          mercadoBTTS,
          ["no"]
        );

      const resultado =
        dosProbabilidades(
          si,
          no
        );

      if (resultado) {
        btts = {
          si: resultado.over,
          no: resultado.under
        };
      }
    }

    /*
    ============================================================
    MÁS 2.5 GOLES
    ============================================================
    */

    const mercadoGoles =
      buscarMercado([
        "goals over under",
        "over under"
      ]);

    if (mercadoGoles) {
      const over25 =
        buscarOpcion(
          mercadoGoles,
          ["over 2.5"]
        );

      const under25 =
        buscarOpcion(
          mercadoGoles,
          ["under 2.5"]
        );

      const resultado =
        dosProbabilidades(
          over25,
          under25
        );

      if (resultado) {
        goles.mas25 =
          resultado.over;
      }
    }

    /*
    ============================================================
    MENOS 4.5 GOLES
    ============================================================
    */

    if (mercadoGoles) {
      const over45 =
        buscarOpcion(
          mercadoGoles,
          ["over 4.5"]
        );

      const under45 =
        buscarOpcion(
          mercadoGoles,
          ["under 4.5"]
        );

      const resultado =
        dosProbabilidades(
          over45,
          under45
        );

      if (resultado) {
        goles.menos45 =
          resultado.under;
      }
    }

    /*
    ============================================================
    CORNERS
    ============================================================
    */

    let corners = {
      mas75: null,
      menos115: null
    };

    const mercadoCorners =
      buscarMercado([
        "corners over under",
        "corner over under",
        "total corners"
      ]);

    if (mercadoCorners) {
      const over75 =
        buscarOpcion(
          mercadoCorners,
          ["over 7.5"]
        );

      const under75 =
        buscarOpcion(
          mercadoCorners,
          ["under 7.5"]
        );

      const under115 =
        buscarOpcion(
          mercadoCorners,
          ["under 11.5"]
        );

      const resultado75 =
        dosProbabilidades(
          over75,
          under75
        );

      if (resultado75) {
        corners.mas75 =
          resultado75.over;
      }

      if (under115) {
        const p =
          probCuota(
            under115.odd
          );

        if (p !== null) {
          corners.menos115 =
            porcentaje(p);
        }
      }
    }

    /*
    ============================================================
    TARJETAS
    ============================================================
    */

    let tarjetas = {
      mas25: null,
      menos55: null
    };

    const mercadoTarjetas =
      buscarMercado([
        "cards over under",
        "total cards",
        "cards"
      ]);

    if (mercadoTarjetas) {
      const over25 =
        buscarOpcion(
          mercadoTarjetas,
          ["over 2.5"]
        );

      const under25 =
        buscarOpcion(
          mercadoTarjetas,
          ["under 2.5"]
        );

      const under55 =
        buscarOpcion(
          mercadoTarjetas,
          ["under 5.5"]
        );

      const resultado25 =
        dosProbabilidades(
          over25,
          under25
        );

      if (resultado25) {
        tarjetas.mas25 =
          resultado25.over;
      }

      if (under55) {
        const p =
          probCuota(
            under55.odd
          );

        if (p !== null) {
          tarjetas.menos55 =
            porcentaje(p);
        }
      }
    }

    /*
    ============================================================
    DOBLE OPORTUNIDAD
    ============================================================
    */

    const dobleOportunidad = {
      "1X": null,
      "X2": null,
      "12": null
    };

    const mercadoDoble =
      buscarMercado([
        "double chance",
        "doble oportunidad"
      ]);

    if (mercadoDoble) {
      for (const item of mercadoDoble.values) {
        const valor =
          normalizar(item?.value);

        const p =
          probCuota(item?.odd);

        if (p === null) continue;

        if (valor === "1x") {
          dobleOportunidad["1X"] =
            porcentaje(p);
        }

        if (valor === "x2") {
          dobleOportunidad["X2"] =
            porcentaje(p);
        }

        if (valor === "12") {
          dobleOportunidad["12"] =
            porcentaje(p);
        }
      }
    }

    /*
    ============================================================
    RESPUESTA
    ============================================================
    */

    return res.status(200).json({
      success: true,

      disponible:
        prediction !== null ||
        mercados.length > 0,

      fixture: fixtureId,

      partido: {
        local,
        visitante
      },

      liga,
      pais,

      predictions: {
        unoXdos,

        btts,

        goles,

        corners,

        tarjetas,

        dobleOportunidad,

        winner: {
          nombre: ganador
        },

        advice: consejo,

        underOver: underOverAPI,

        golesEstimados: {
          local: golesLocal,
          visitante: golesVisitante
        }
      },

      fuente: {
        prediccion: "API-Football",
        cuotas:
          mercados.length > 0
            ? "API-Football Odds"
            : null
      },

      estado:
        prediction !== null
          ? "prediccion_completa"
          : mercados.length > 0
            ? "cuotas_disponibles"
            : "sin_datos",

      errores: {
        predictions:
          predictionData?.errors || [],

        odds:
          oddsData?.errors || []
      }
    });

  } catch (error) {
    console.error(
      "ERROR PREDICCIONES:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Error consultando API-Football",
      detalle: error.message
    });
  }
  }
