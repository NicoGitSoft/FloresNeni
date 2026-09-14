export function applyImageTone(container, image) {

  if (!container || !image) return;

  const process = () => {

    try {

      const canvas = document.createElement('canvas');

      canvas.width = 48;
      canvas.height = 48;

      const ctx = canvas.getContext('2d', {
        willReadFrequently: true
      });

      ctx.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const {
        data
      } = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      let fallbackR = 0;
      let fallbackG = 0;
      let fallbackB = 0;
      let fallbackCount = 0;


      for (
        let index = 0;
        index < data.length;
        index += 4
      ) {

        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const alpha = data[index + 3];

        if (alpha < 100) continue;

        fallbackR += red;
        fallbackG += green;
        fallbackB += blue;
        fallbackCount++;


        const max =
          Math.max(
            red,
            green,
            blue
          );

        const min =
          Math.min(
            red,
            green,
            blue
          );


        const chroma =
          max - min;


        const brightness =
          (
            red +
            green +
            blue
          ) / 3;


        /*
         * Ignoramos fondos blancos,
         * grises y negros casi puros.
         *
         * Queremos encontrar flores,
         * papeles y verdes.
         */

        if (
          chroma < 22 ||
          brightness > 242 ||
          brightness < 30
        ) {
          continue;
        }


        r += red;
        g += green;
        b += blue;

        count++;

      }


      if (count === 0) {

        r = fallbackR;
        g = fallbackG;
        b = fallbackB;

        count =
          Math.max(
            fallbackCount,
            1
          );

      }


      r =
        Math.round(
          r / count
        );

      g =
        Math.round(
          g / count
        );

      b =
        Math.round(
          b / count
        );


      container.style.setProperty(
        '--image-tone',
        `rgb(${r} ${g} ${b})`
      );

    }

    catch (error) {

      console.warn(
        'No fue posible obtener el color de la imagen.',
        error
      );

    }

  };


  if (image.complete) {

    process();

  }

  else {

    image.addEventListener(
      'load',
      process,
      {
        once: true
      }
    );

  }

}
