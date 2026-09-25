export default async function handler(request, response) {

  try {

    const API_KEY = process.env.API_FOOTBALL_KEY;

    if (!API_KEY) {

      return response.status(500).json({
        success: false,
        error: "Falta configurar API_FOOTBALL_KEY en Vercel"
      });

    }


    const headers = {
      "x-apisports-key": API_KEY,
      "Accept": "application/json"
    };


    const ahora = new Date();

    const hoy =
      ahora.toISOString().split("T")[0];


    const mananaFecha =
      new Date(ahora);

    mananaFecha.setUTCDate(
      mananaFecha.getUTCDate() + 1
    );

    const manana =
      mananaFecha.toISOString().split("T")[0];


    /* ==========================================
       FUNCION PARA CONSULTAR API-FOOTBALL
    ========================================== */

    async function consultar(url) {

      const r = await fetch(
        url,
        {
          method: "GET",
          headers
        }
      );


      const data =
        await r.json();


      return {
        ok: r.ok,
        status: r.status,
        data
      };

    }


    /* ==========================================
       PARTIDOS EN VIVO
    ========================================== */

    const live =
      await consultar(
        "https://v3.football.api-sports.io/fixtures?live=all"
      );


    if (!live.ok) {

      return response.status(500).json({

        success: false,

        error:
          "API-Football rechazó la consulta de partidos en vivo",

        status:
          live.status,

        detalles:
          live.data

      });

    }


    const enVivo =
      live.data?.response || [];


    /* ==========================================
       PARTIDOS DE HOY
    ========================================== */

    const hoyResultado =
      await consultar(
        `https://v3.football.api-sports.io/fixtures?date=${hoy}`
      );


    if (!hoyResultado.ok) {

      return response.status(500).json({

        success: false,

        error:
          "API-Football rechazó la consulta de partidos de hoy",

        status:
          hoyResultado.status,

        detalles:
          hoyResultado.data

      });

    }


    const partidosHoy =
      hoyResultado.data?.response || [];


    /* ==========================================
       PARTIDOS DE MAÑANA
    ========================================== */

    const mananaResultado =
      await consultar(
        `https://v3.football.api-sports.io/fixtures?date=${manana}`
      );


    if (!mananaResultado.ok) {

      return response.status(500).json({

        success: false,

        error:
          "API-Football rechazó la consulta de mañana",

        status:
          mananaResultado.status,

        detalles:
          mananaResultado.data

      });

    }


    const partidosManana =
      mananaResultado.data?.response || [];


    /* ==========================================
       ELIMINAR DUPLICADOS
    ========================================== */

    const mapa =
      new Map();


    [
      ...enVivo,
      ...partidosHoy,
      ...partidosManana
    ].forEach(
      partido => {

        const id =
          partido?.fixture?.id;

        if (id) {

          mapa.set(
            id,
            partido
          );

        }

      }
    );


    const partidos =
      Array.from(
        mapa.values()
      );


    /* ==========================================
       INFORMACIÓN DE API
    ========================================== */

    return response.status(200).json({

      success: true,

      fechaActual:
        ahora.toISOString(),

      hoy,

      manana,

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

      /* INFORMACIÓN PARA DEPURAR */

      api: {

        liveErrors:
          live.data?.errors || {},

        hoyErrors:
          hoyResultado.data?.errors || {},

        mananaErrors:
          mananaResultado.data?.errors || {},

        liveResults:
          live.data?.results ?? null,

        hoyResults:
          hoyResultado.data?.results ?? null,

        mananaResults:
          mananaResultado.data?.results ?? null

      }

    });


  } catch (error) {

    console.error(
      "ERROR FOOTBALL API:",
      error
    );


    return response.status(500).json({

      success: false,

      error:
        "Error interno del servidor",

      detalles:
        error?.message || String(error)

    });

  }

}
