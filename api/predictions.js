export default async function handler(req, res) {
  try {
    const home = String(req.query.home || "").trim();
    const away = String(req.query.away || "").trim();

    if (!home || !away) {
      return res.status(400).json({
        success: false,
        error: "Faltan los equipos local y visitante"
      });
    }

    /*
      ============================================================
      YOGER ATENCIO SPORT - MOTOR DE PRONÓSTICOS
      ============================================================

      Importante:
      - No hace una petición nueva a API-Football por cada mercado.
      - Para partidos sin información estadística suficiente,
        NO inventamos porcentajes.
      - Junior vs Independiente Medellín conserva el consenso
        específico que ya verificamos.
    */

    const normalizar = (texto) =>
      texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

    const h = normalizar(home);
    const a = normalizar(away);

    // ============================================================
    // CONSENSO ESPECÍFICO: JUNIOR vs INDEPENDIENTE MEDELLÍN
    // ============================================================

    const esJuniorMedellin =
      (h.includes("junior") &&
        (a.includes("independientemedellin") ||
         a.includes("medellin"))) ||
      (a.includes("junior") &&
        (h.includes("independientemedellin") ||
         h.includes("medellin")));

    if (esJuniorMedellin) {
      const localEsJunior = h.includes("junior");

      const datos = localEsJunior
        ? {
            local: home,
            visitante: away,
            unoXdos: {
              local: 34.9,
              empate: 27.4,
              visitante: 37.6
            }
          }
        : {
            local: home,
            visitante: away,
            unoXdos: {
              local: 37.6,
              empate: 27.4,
              visitante: 34.9
            }
          };

      return res.status(200).json({
        success: true,

        predictions: {
          partido: {
            local: home,
            visitante: away
          },

          unoXdos: datos.unoXdos,

          goles: {
            mas15: 72,
            menos35: 67
          },

          btts: {
            si: 66.3,
            no: 33.8
          },

          corners: {
            mas65: 82,
            menos115: 78
          },

          tarjetas: {
            mas35: 69,
            menos55: 72
          },

          otros: [
            {
              mercado: "Doble oportunidad",
              opcion: "12",
              porcentaje: 73
            },
            {
              mercado: "Más 2.5 goles",
              opcion: "Sí",
              porcentaje: 64
            }
          ],

          fuentes: [
            "BetStudy",
            "Forebet",
            "WinDrawWin",
            "TopBetPredict",
            "FootyBets"
          ],

          metodologia:
            "Consenso de fuentes de pronósticos + estadísticas disponibles + análisis Yoger",

          estado: "consenso_calculado"
        }
      });
    }

    // ============================================================
    // OTROS PARTIDOS
    // ============================================================
    //
    // No vamos a fabricar porcentajes.
    //
    // El frontend podrá mostrar:
    // "Sin datos específicos de consenso"
    //
    // Esto permite que TODOS los partidos tengan su botón
    // de pronósticos sin mostrar información falsa.
    // ============================================================

    return res.status(200).json({
      success: true,

      predictions: {
        partido: {
          local: home,
          visitante: away
        },

        unoXdos: null,

        goles: {
          mas15: null,
          menos35: null
        },

        btts: {
          si: null,
          no: null
        },

        corners: {
          mas65: null,
          menos115: null
        },

        tarjetas: {
          mas35: null,
          menos55: null
        },

        otros: [],

        fuentes: [],

        metodologia:
          "No hay suficientes datos específicos de consenso para este partido.",

        estado: "sin_datos_especificos"
      }
    });

  } catch (error) {
    console.error("Error en predictions.js:", error);

    return res.status(500).json({
      success: false,
      error: "Error interno al calcular los pronósticos"
    });
  }
}
