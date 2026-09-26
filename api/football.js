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

  /*
   * =========================================================
   * COMPETICIONES PERMITIDAS
   * =========================================================
   *
   * Solo mostramos estas competiciones.
   *
   * IMPORTANTE:
   * "Liga" significa únicamente la primera categoría.
   * No mostramos Segunda, Tercera, etc.
   */

  const COMPETICIONES_PERMITIDAS = {

    "Spain": [
      "La Liga",
      "Copa del Rey",
      "Super Cup"
    ],

    "France": [
      "Ligue 1",
      "Coupe de France",
      "Trophée des Champions"
    ],

    "Germany": [
      "Bundesliga",
      "DFB Pokal",
      "Super Cup"
    ],

    "Italy": [
      "Serie A",
      "Coppa Italia",
      "Super Cup"
    ],

    "England": [
      "Premier League",
      "FA Cup",
      "EFL Cup",
      "Community Shield"
    ],

    "Norway": [
      "Eliteserien",
      "NM Cup"
    ],

    "Denmark": [
      "Superliga",
      "DBU Pokalen"
    ],

    "Belgium": [
      "Jupiler Pro League",
      "Cup"
    ],

    "Switzerland": [
      "Super League",
      "Schweizer Cup"
    ],

    "Bulgaria": [
      "First League",
      "Cup"
    ],

    "World": [
      "Champions League",
      "Europa League",
      "Conference League",
      "World Cup",
      "Copa America",
      "UEFA Nations League"
    ],

    "USA": [
      "Major League Soccer",
      "Leagues Cup"
    ],

    "Brazil": [
      "Serie A",
      "Copa do Brasil",
      "Supercopa do Brasil"
    ],

    "Colombia": [
      "Primera A",
      "Copa Colombia"
    ],

    "Europe": [
      "Euro Championship"
    ]

  };


  /*
   * =========================================================
   * NORMALIZAR TEXTO
   * =========================================================
   */

  function normalizarTexto(texto) {

    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  }


  /*
   * =========================================================
   * COMPROBAR SI LA COMPETICIÓN ESTÁ PERMITIDA
   * =========================================================
   */

  function esCompeticionPermitida(partido) {

    const liga = partido?.league;

    if (!liga) {
      return false;
    }

    const nombreLiga =
      normalizarTexto(liga.name);

    const pais =
      normalizarTexto(liga.country);

    /*
     * Buscamos por país y nombre.
     */

    for (const [paisPermitido, ligasPermitidas]
      of Object.entries(COMPETICIONES_PERMITIDAS)) {

      if (
        normalizarTexto(paisPermitido) === pais
      ) {

        const encontrada =
          ligasPermitidas.some(nombre => {

            return (
              normalizarTexto(nombre) ===
              nombreLiga
            );

          });

        if (encontrada) {
          return true;
        }
      }
    }


    /*
     * =======================================================
     * COMPETICIONES INTERNACIONALES
     * =======================================================
     */

    const internacionales = [
      "Champions League",
      "Europa League",
      "Conference League",
      "World Cup",
      "Copa America",
      "UEFA Nations League",
      "Euro Championship"
    ];


    if (
      internacionales.some(nombre =>

        normalizarTexto(nombre) ===
        nombreLiga

      )
    ) {

      return true;

    }


    /*
     * =======================================================
     * MLS
     * =======================================================
     */

    if (
      nombreLiga ===
      normalizarTexto("Major League Soccer")
    ) {

      return true;

    }


    /*
     * LEAGUES CUP
     */

    if (
      nombreLiga ===
      normalizarTexto("Leagues Cup")
    ) {

      return true;

    }


    return false;

  }


  /*
   * =========================================================
   * FILTRAR PARTIDOS
   * =========================================================
   */

  function filtrarPartidos(lista) {

    if (!Array.isArray(lista)) {
      return [];
    }

    return lista.filter(partido =>
      esCompeticionPermitida(partido)
    );

  }


  try {

    /*
     * =========================================================
     * PREDICCIÓN DE UN PARTIDO
     * =========================================================
     *
     * /api/football?prediction=ID
     */

    if (request.query.prediction) {

      const fixtureId =
        request.query.prediction;

      const url =
        `${baseURL}/predictions?fixture=${encodeURIComponent(fixtureId)}`;

      const apiResponse =
        await fetch(url, {
          method: "GET",
          headers
        });

      const data =
        await apiResponse.json();


      if (!apiResponse.ok) {

        return response.status(apiResponse.status).json({

          success: false,

          tipo: "prediction",

          fixture: fixtureId,

          error:
            data?.errors ||
            "Error consultando predicción"

        });

      }


      if (
        data?.errors &&
        Object.keys(data.errors).length > 0
      ) {

        return response.status(200).json({

          success: false,

          tipo: "prediction",

          fixture: fixtureId,

          error: data.errors

        });

      }


      const resultado =
        data?.response?.[0];


      if (!resultado) {

        return response.status(200).json({

          success: true,

          tipo: "prediction",

          fixture: fixtureId,

          disponible: false,

          predictions: null

        });

      }


      const pred =
        resultado.predictions || {};

      const percent =
        pred.percent || {};


      const local =
        percent.home ?? null;

      const empate =
        percent.draw ?? null;

      const visitante =
        percent.away ?? null;


      const btts =
        pred.btts?.yes ?? null;


      const underOver =
        pred.under_over ?? null;


      let ganador = null;


      if (pred.winner) {

        ganador =
          pred.winner.name ?? null;

      }


      const consejo =
        pred.advice ?? null;


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

            no:
              pred.btts?.no ?? null

          },

          under_over:
            underOver,

          winner: {

            name:
              ganador

          },

          advice:
            consejo,

          goals: {

            home:
              pred.goals?.home ?? null,

            away:
              pred.goals?.away ?? null

          },

          win_or_draw:
            pred.win_or_draw ?? null

        }

      });

    }


    /*
     * =========================================================
     * CONSULTA DIRECTA POR FIXTURE
     * =========================================================
     *
     * /api/football?fixture=ID
     */

    if (request.query.fixture) {

      const fixtureId =
        request.query.fixture;

      const url =
        `${baseURL}/fixtures?id=${encodeURIComponent(fixtureId)}`;

      const apiResponse =
        await fetch(url, {
          method: "GET",
          headers
        });

      const data =
        await apiResponse.json();

      return response
        .status(apiResponse.status)
        .json(data);

    }


    /*
     * =========================================================
     * FECHAS
     * =========================================================
     */

    const ahora =
      new Date();


    const fechaHoy =
      ahora.toISOString().slice(0, 10);


    const mananaDate =
      new Date(
        ahora.getTime() +
        24 * 60 * 60 * 1000
      );


    const fechaManana =
      mananaDate.toISOString().slice(0, 10);


    /*
     * =========================================================
     * URLS
     * =========================================================
     */

    const urlLive =
      `${baseURL}/fixtures?live=all`;


    const urlHoy =
      `${baseURL}/fixtures?date=${fechaHoy}`;


    const urlManana =
      `${baseURL}/fixtures?date=${fechaManana}`;


    /*
     * =========================================================
     * LLAMADAS
     * =========================================================
     */

    const [
      liveResult,
      hoyResult,
      mananaResult
    ] = await Promise.all([

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
     * =========================================================
     * JSON
     * =========================================================
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

      live:
        liveData?.errors || null,

      hoy:
        hoyData?.errors || null,

      manana:
        mananaData?.errors || null

    };


    /*
     * =========================================================
     * PARTIDOS ORIGINALES
     * =========================================================
     */

    const enVivoOriginal =
      Array.isArray(liveData?.response)
        ? liveData.response
        : [];


    const partidosHoyOriginal =
      Array.isArray(hoyData?.response)
        ? hoyData.response
        : [];


    const partidosMananaOriginal =
      Array.isArray(mananaData?.response)
        ? mananaData.response
        : [];


    /*
     * =========================================================
     * APLICAR FILTRO
     * =========================================================
     */

    const enVivo =
      filtrarPartidos(
        enVivoOriginal
      );


    const partidosHoy =
      filtrarPartidos(
        partidosHoyOriginal
      );


    const partidosManana =
      filtrarPartidos(
        partidosMananaOriginal
      );


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
      Array.from(
        mapa.values()
      );


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
