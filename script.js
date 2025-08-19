// script.js (v0.3)

// --- Pegando os elementos do HTML pra gente usar ---
const imageUpload = document.getElementById('imageUpload');
const pixelSizeSlider = document.getElementById('pixelSize');
const pixelSizeValue = document.getElementById('pixelSizeValue');
const pixelSizeValueHeight = document.getElementById('pixelSizeValueHeight');
const colorCountSlider = document.getElementById('colorCount');
const colorCountValue = document.getElementById('colorCountValue');
const processBtn = document.getElementById('processBtn');
const outputCanvas = document.getElementById('outputCanvas');
const outputCtx = outputCanvas.getContext('2d');
const placeholder = document.getElementById('placeholder');
const outputArea = document.getElementById('outputArea');
const loader = document.getElementById('loader');

// Canvas oculto, serve como nossa "mesa de trabalho" pra analisar a imagem original
const sourceCanvas = document.getElementById('sourceCanvas');
const sourceCtx = sourceCanvas.getContext('2d');

// Variável pra guardar a imagem que o usuário enviou
let originalImage = null;

// --- Configurando os Eventos ---

// Quando o usuário escolhe uma imagem
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        originalImage = new Image();
        originalImage.onload = () => {
            processBtn.disabled = false; // Libera o botão de pixelizar
            placeholder.textContent = "Imagem carregada! Ajuste os controles e clique para pixelizar.";
            // Dispara um evento 'input' no slider pra atualizar a altura da grade
            pixelSizeSlider.dispatchEvent(new Event('input'));
        };
        originalImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Atualiza o texto que mostra o tamanho da grade
pixelSizeSlider.addEventListener('input', () => {
    const width = pixelSizeSlider.value;
    pixelSizeValue.textContent = width;
    if (originalImage) {
        // Mantém a proporção da imagem original
        const aspectRatio = originalImage.height / originalImage.width;
        const height = Math.round(width * aspectRatio);
        pixelSizeValueHeight.textContent = height;
    } else {
         pixelSizeValueHeight.textContent = width; // Se não tem imagem, a grade é quadrada
    }
});

// Atualiza o texto que mostra o número de cores
colorCountSlider.addEventListener('input', () => {
    colorCountValue.textContent = colorCountSlider.value;
});

// O botão principal que dispara todo o processo
processBtn.addEventListener('click', () => {
    if (!originalImage) {
        alert("Por favor, envie uma imagem primeiro.");
        return;
    }
    // Esconde o placeholder, mostra o loader e a área de resultado
    placeholder.classList.add('hidden');
    outputArea.classList.add('hidden');
    loader.style.display = 'flex';

    // Usamos um setTimeout pra dar tempo do navegador mostrar o loader antes de começar o trabalho pesado
    setTimeout(processImage, 50);
});

// --- Funções de Processamento da Imagem ---

function processImage() {
    // 1. Pega os valores dos sliders
    const numPixelsWide = parseInt(pixelSizeSlider.value);
    const aspectRatio = originalImage.height / originalImage.width;
    const numPixelsHigh = Math.round(numPixelsWide * aspectRatio);
    
    // 2. Desenha a imagem original no nosso canvas de trabalho (o oculto)
    sourceCanvas.width = originalImage.width;
    sourceCanvas.height = originalImage.height;
    sourceCtx.drawImage(originalImage, 0, 0);

    // 3. A mágica acontece aqui: reduzimos as cores da imagem
    const k = parseInt(colorCountSlider.value);
    const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const pixels = getPixels(imageData);
    const palette = getPalette(pixels, k); // Encontra as 'k' cores principais
    const mappedPixels = mapPixelsToPalette(pixels, palette); // Mapeia cada pixel pra cor mais próxima da paleta

    // 4. Prepara o canvas final pra desenhar o resultado
    const pixelWidth = Math.ceil(originalImage.width / numPixelsWide);
    const pixelHeight = Math.ceil(originalImage.height / numPixelsHigh);
    const POINT_SIZE = 10; // Cada "ponto" do nosso gráfico terá 10x10 pixels na tela
    outputCanvas.width = numPixelsWide * POINT_SIZE;
    outputCanvas.height = numPixelsHigh * POINT_SIZE;

    // 5. Desenha a imagem pixelizada
    for (let y = 0; y < numPixelsHigh; y++) {
        for (let x = 0; x < numPixelsWide; x++) {
            const sourceX = Math.floor(x * pixelWidth);
            const sourceY = Math.floor(y * pixelHeight);
            // Pega a cor dominante daquele bloco da imagem original
            const dominantColor = getDominantColor(mappedPixels, sourceX, sourceY, pixelWidth, pixelHeight, originalImage.width, palette);
            
            outputCtx.fillStyle = `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`;
            outputCtx.fillRect(x * POINT_SIZE, y * POINT_SIZE, POINT_SIZE, POINT_SIZE);
        }
    }

    // 6. Esconde o loader e mostra o resultado
    loader.style.display = 'none';
    outputArea.classList.remove('hidden');
}

// --- Algoritmos de Quantização de Cores (k-means simplificado) ---

// Pega todos os pixels da imagem e coloca num array pra gente trabalhar
function getPixels(imageData) {
    const pixels = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
        pixels.push([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]]);
    }
    return pixels;
}

// Acha as 'k' cores principais da imagem
function getPalette(pixels, k) {
    let centroids = [];
    // Começa com 'k' cores aleatórias da imagem
    for (let i = 0; i < k; i++) {
        centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
    }

    // O k-means é meio pesado, então limitamos as iterações pra não travar o navegador
    for (let iter = 0; iter < 10; iter++) {
        const clusters = Array.from({ length: k }, () => []);
        // Associa cada pixel ao centroide (cor) mais próximo
        pixels.forEach(pixel => {
            let minDistance = Infinity;
            let closestCentroidIndex = 0;
            centroids.forEach((centroid, index) => {
                const distance = colorDistance(pixel, centroid);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCentroidIndex = index;
                }
            });
            clusters[closestCentroidIndex].push(pixel);
        });

        // Recalcula os centroides baseados na média das cores de cada cluster
        centroids = clusters.map(cluster => {
            if (cluster.length === 0) {
                return pixels[Math.floor(Math.random() * pixels.length)];
            }
            const sum = cluster.reduce((acc, pixel) => [acc[0] + pixel[0], acc[1] + pixel[1], acc[2] + pixel[2]], [0, 0, 0]);
            return [Math.round(sum[0] / cluster.length), Math.round(sum[1] / cluster.length), Math.round(sum[2] / cluster.length)];
        });
    }
    return centroids;
}

// Pega a lista de pixels originais e substitui cada um pela cor mais próxima da nossa paleta reduzida
function mapPixelsToPalette(pixels, palette) {
    return pixels.map(pixel => {
        let minDistance = Infinity;
        let closestColor = palette[0];
        palette.forEach(color => {
            const distance = colorDistance(pixel, color);
            if (distance < minDistance) {
                minDistance = distance;
                closestColor = color;
            }
        });
        return closestColor;
    });
}

// Pega um bloco da imagem original (já com cores reduzidas) e acha a cor que mais aparece
function getDominantColor(mappedPixels, startX, startY, width, height, imageWidth, palette) {
    const colorCounts = {};
    palette.forEach(color => colorCounts[color.join(',')] = 0);

    for (let y = startY; y < startY + height; y++) {
        for (let x = startX; x < startX + width; x++) {
            const index = y * imageWidth + x;
            if (mappedPixels[index]) {
                const colorKey = mappedPixels[index].join(',');
                colorCounts[colorKey]++;
            }
        }
    }

    let dominantColorKey = Object.keys(colorCounts)[0];
    let maxCount = 0;
    for (const colorKey in colorCounts) {
        if (colorCounts[colorKey] > maxCount) {
            maxCount = colorCounts[colorKey];
            dominantColorKey = colorKey;
        }
    }
    return dominantColorKey.split(',').map(Number);
}

// Calcula a "distância" entre duas cores (distância euclidiana no espaço RGB)
function colorDistance(c1, c2) {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return dr * dr + dg * dg + db * db;
}
