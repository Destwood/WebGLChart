const canvas = document.getElementById("glcanvas");

const gl = canvas.getContext("experimental-webgl", {
    premultipliedAlpha: false,
    alpha: true,
});
let texture;
const image = new Image();
image.src = "/assets/Binance_Logo.png";
image.onload = () =>
{
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (canvas.width === 0 || canvas.height === 0)
    {
        canvas.width = image.width;
        canvas.height = image.height;
    }
};
image.onerror = (err) =>
{
    console.error("Failed to load image", err);
};
document.body.style.backgroundColor = "black";

let lastFiveIterations = [
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
    500, 500, 500, 500, 500,
];
const names = [ "0", "1", "2", "3", "4", "5", "6", "7", "8", "9" ];

const textData = {
    texts: [
        {
            text: `$ 5`,
            fontSize: 24,
            fontColor: "#5AA45A",
            backgroundColor: "#0C0C0E",
        },
        {
            text: "binance / BNBUSDC",
            fontSize: 14,
            fontColor: "#DEDEE0",
            backgroundColor: "#0C0C0E",
        },
    ],
};

roboto_font.tex = loadTexture(gl, "fonts/roboto.png", gl.LUMINANCE, false);

// text code -----------------------------------------
const arrowVertCode = `
    attribute vec2 a_position;
    uniform mat3 u_transform;
    void main() {
        gl_Position = vec4((u_transform * vec3(a_position, 1.0)).xy, 0.0, 1.0);
    }
`;

const arrowFragCode = `
    precision mediump float;
    uniform vec4 u_color;
    void main() {
        gl_FragColor = u_color;
    }
`;

let arrowBuffer;

const arrowProgram = createProgram(gl, arrowVertCode, arrowFragCode, [
    { loc: 0, name: "a_position", size: 2 },
]);
arrowProgram.transform = gl.getUniformLocation(arrowProgram.id, "u_transform");
arrowProgram.color = gl.getUniformLocation(arrowProgram.id, "u_color");

function renderArrow ()
{
    gl.useProgram(arrowProgram.id);
    gl.bindBuffer(gl.ARRAY_BUFFER, arrowBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const ws = 2.0 / canvas.width;
    const hs = 2.0 / canvas.height;

    const arrowTransform = new Float32Array([ ws, 0, 0, 0, hs, 0, 0, 0, 1 ]);

    gl.uniformMatrix3fv(arrowProgram.transform, false, arrowTransform);
    gl.uniform4f(arrowProgram.color, 1.0, 1.0, 1.0, 1.0); // білий колір

    gl.drawArrays(gl.LINES, 0, 2); // Малюємо лінію
    gl.drawArrays(gl.LINES, 2, 4); // Малюємо наконечник стрілки
    gl.drawArrays(gl.LINES, 4, 6); // Малюємо наконечник стрілки

    gl.disableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}
// text code -----------------------------------------
function evaluateBezierCurve (points, t)
{
    const n = points.length / 2 - 1;
    let x = 0;
    let y = 0;
    for (let i = 0; i <= n; i++)
    {
        const b = bernstein(n, i, t);
        const px = points[ i * 2 ];
        const py = points[ i * 2 + 1 ];
        x += px * b;
        y += py * b;
    }
    return [ x, y ];
}

function bernstein (n, i, t)
{
    const coef = factorial(n) / (factorial(i) * factorial(n - i));
    return coef * Math.pow(t, i) * Math.pow(1 - t, n - i);
}

function factorial (n)
{
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++)
    {
        result *= i;
    }
    return result;
}
function generateBezierPoints (points, segments)
{
    const bezierPoints = [];
    for (let i = 0; i <= segments; i++)
    {
        const t = i / segments;
        const [ x, y ] = evaluateBezierCurve(points, t);
        bezierPoints.push(x, y);
    }
    return bezierPoints;
}
function glMain ()
{
    const attribs = [
        { loc: 0, name: "pos", size: 2 },
        { loc: 1, name: "tex0", size: 2 },
        { loc: 2, name: "sdf_size", size: 1 },
    ];
    initAttribs(gl, attribs);

    const vertex_array = new Float32Array((10000 * 6 * attribs[ 0 ].stride) / 4);

    const vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertex_array, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.enable(gl.BLEND);

    const prog = createProgram(gl, vertCode, fragCode, attribs);

    const pointVertCode = `
        attribute vec2 pos;
        uniform float pointSize;
        void main() {
            gl_PointSize = pointSize;
            gl_Position = vec4(pos, 0.0, 1.0);
        }
    `;

    const pointFragCode = `
        precision mediump float;
        uniform vec4 color;
        void main() {
            gl_FragColor = color;
        }
    `;

    const pointProg = createProgram(gl, pointVertCode, pointFragCode, [
        { loc: 0, name: "pos", size: 2 },
    ]);

    pointProg.pointSize = gl.getUniformLocation(pointProg.id, "pointSize");
    pointProg.color = gl.getUniformLocation(pointProg.id, "color");

    let str_res;
    let vcount = 0;
    let tex;

    let font_hinting = 1.0;
    let subpixel = 1.0;
    let bg_color = [ 0.9, 0.9, 0.9 ];
    let pixel_ratio = window.devicePixelRatio || 1;

    function render ()
    {
        gl.clearColor(bg_color[ 0 ], bg_color[ 1 ], bg_color[ 2 ], 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, canvas.width, canvas.height);
        let chartPoints;

        textData.texts.forEach((textItem, index) =>
        {
            let combinedValue = 500;
            if (index === 0)
            {
                const price = Math.floor(Math.random() * 101) + 500;
                const afterDot = Math.floor(Math.random() * 100, 2);
                combinedValue = parseFloat(`${ price }.${ afterDot }`);
                textData.texts[ 0 ].text = `$ ${ combinedValue }`;
                if (lastFiveIterations.length >= 5)
                {
                    lastFiveIterations.shift();
                }
                lastFiveIterations.push(combinedValue);
                const chartMax = 650;
                const chartMin = 500;

                function calculateY (max, min, item)
                {
                    const range = max - min;
                    const normalizedValue = (max - item) / range;
                    const y = normalizedValue * 0.4 - 0.4;
                    return y - 0.2;
                }

                chartPoints = [
                    -0.4,
                    calculateY(chartMin, chartMax, lastFiveIterations[ 0 ]),
                    -0.2,
                    calculateY(chartMin, chartMax, lastFiveIterations[ 1 ]),
                    -0.0,
                    calculateY(chartMin, chartMax, lastFiveIterations[ 2 ]),
                    0.2,
                    calculateY(chartMin, chartMax, lastFiveIterations[ 3 ]),
                    0.4,
                    calculateY(chartMin, chartMax, lastFiveIterations[ 4 ]),
                ];
            }

            const font_size = Math.round(textItem.fontSize * pixel_ratio);
            const fmetrics = fontMetrics(roboto_font, font_size, font_size * 0.2);

            let font_color;
            if (
                lastFiveIterations[ lastFiveIterations.length - 2 ] > combinedValue &&
                index === 0
            )
            {
                font_color = colorFromString("#F83D3C", [ 0.1, 0.1, 0.1 ]);
                console.log(font_color);
            } else
            {
                font_color = colorFromString(textItem.fontColor, [ 0.1, 0.1, 0.1 ]);
            }
            bg_color = colorFromString(textItem.backgroundColor, [ 0.9, 0.9, 0.9 ]);

            tex = roboto_font.tex;

            function measureTextWidth (text, font, fontSize)
            {
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                context.font = `${ fontSize }px ${ font }`;
                const metrics = context.measureText(text);
                return metrics.width;
            }

            const arrowVertices = new Float32Array([
                100, -5, 100, 12, 95, 3, 100, 12, 100, 12, 105, 3,
            ]);

            arrowBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, arrowBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, arrowVertices, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);

            const textWidth = measureTextWidth(textItem.text, "Roboto", font_size);
            let spaceTo;
            if (index === 1)
            {
                spaceTo = Math.round(-0.5 * textWidth + 10);
            } else
            {
                spaceTo = Math.round(-0.5 * textWidth);
            }

            str_res = writeString(
                textItem.text,
                roboto_font,
                fmetrics,
                [ spaceTo, -index * fmetrics.line_height ],
                vertex_array
            );

            vcount = str_res.array_pos / (attribs[ 0 ].stride / 4);

            gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertex_array);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);

            const dx = Math.round(-0.5 * str_res.rect[ 2 ]);
            const dy = Math.round(0.5 * str_res.rect[ 3 ]);

            const ws = 2.0 / canvas.width;
            const hs = 2.0 / canvas.height;

            const screen_mat = new Float32Array([
                ws,
                0,
                0,
                0,
                hs,
                0,
                dx * ws,
                dy * hs,
                1,
            ]);

            gl.useProgram(prog.id);

            prog.font_tex.set(0);
            prog.sdf_tex_size.set(tex.image.width, tex.image.height);
            prog.sdf_border_size.set(roboto_font.iy);
            prog.transform.setv(screen_mat);
            prog.hint_amount.set(font_hinting);
            prog.font_color.set(font_color[ 0 ], font_color[ 1 ], font_color[ 2 ], 1.0);
            prog.subpixel_amount.set(subpixel);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex.id);
            gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
            bindAttribs(gl, attribs);
            gl.blendColor(font_color[ 0 ], font_color[ 1 ], font_color[ 2 ], 1.0);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.CONSTANT_COLOR, gl.ONE_MINUS_SRC_COLOR);

            gl.drawArrays(gl.TRIANGLES, 0, vcount);

            // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            // Інші рендеринг-операції
            renderArrow();
        });

        const bezierPoints = generateBezierPoints([ ...chartPoints ], 55);
        const bezierBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, bezierBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(bezierPoints),
            gl.STATIC_DRAW
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.useProgram(pointProg.id);

        gl.bindBuffer(gl.ARRAY_BUFFER, bezierBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINE_STRIP, 0, bezierPoints.length / 2);
        gl.uniform1f(pointProg.pointSize, 15.0);
        gl.uniform4f(pointProg.color, 0.7843, 0.172, 0.317, 0);

        gl.disableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Рендеринг зображення
        renderImage();

        setTimeout(render, 300);
    }

    function renderImage ()
    {
        const imgVertShaderSrc = `
            attribute vec4 aVertexPosition;
            attribute vec2 aTextureCoord;
            varying highp vec2 vTextureCoord;
            void main(void) {
                gl_Position = aVertexPosition;
                vTextureCoord = aTextureCoord;
            }
        `;

        const imgFragShaderSrc = `
            varying highp vec2 vTextureCoord;
            uniform sampler2D uSampler;
            void main(void) {
                gl_FragColor = texture2D(uSampler, vTextureCoord);
            }
        `;

        const imgProgram = initShaderProgram(
            gl,
            imgVertShaderSrc,
            imgFragShaderSrc
        );

        const imgVertexPosition = gl.getAttribLocation(
            imgProgram,
            "aVertexPosition"
        );
        const imgTextureCoord = gl.getAttribLocation(imgProgram, "aTextureCoord");
        const imgSampler = gl.getUniformLocation(imgProgram, "uSampler");

        const imgBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, imgBuffer);

        const imgVertices = new Float32Array([
            -0.28,
            -0.15,
            0.0,
            0.0, // Нижній лівий кут
            -0.24,
            -0.15,
            1.0,
            0.0, // Нижній правий кут
            -0.24,
            -0.08,
            1.0,
            1.0, // Верхній правий кут
            -0.28,
            -0.08,
            0.0,
            1.0, // Верхній лівий кут
        ]);

        gl.bufferData(gl.ARRAY_BUFFER, imgVertices, gl.STATIC_DRAW);

        const imgIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, imgIndexBuffer);

        const imgIndices = new Uint16Array([ 0, 1, 2, 0, 2, 3 ]);

        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, imgIndices, gl.STATIC_DRAW);

        gl.useProgram(imgProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, imgBuffer);
        gl.vertexAttribPointer(imgVertexPosition, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(imgVertexPosition);
        gl.vertexAttribPointer(imgTextureCoord, 2, gl.FLOAT, false, 16, 8);
        gl.enableVertexAttribArray(imgTextureCoord);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(imgSampler, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, imgIndexBuffer);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        gl.disableVertexAttribArray(imgVertexPosition);
        gl.disableVertexAttribArray(imgTextureCoord);
    }

    requestAnimationFrame(render);
}

function initShaderProgram (gl, vsSource, fsSource)
{
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
    {
        console.error(
            "Unable to initialize the shader program:",
            gl.getProgramInfoLog(shaderProgram)
        );
        return null;
    }

    return shaderProgram;
}

function loadShader (gl, type, source)
{
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    {
        console.error(
            "An error occurred compiling the shaders:",
            gl.getShaderInfoLog(shader)
        );
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

glMain();
