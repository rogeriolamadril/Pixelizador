// script.js (v0.4)

// --- Pegando os elementos do HTML ---
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
const paletteContainer = document.getElementById('paletteContainer'); // NOVO: Pegando o container da paleta

const sourceCanvas = document.getElementById('sourceCanvas');
const sourceCtx = sourceCanvas.getContext('2d');

let originalImage = null;

// --- Configurando os Eventos ---
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        originalImage = new Image();
        originalImage.onload = () => {
            processBtn.disabled = false;
            placeholder.textContent = "Imagem carregada! Ajuste os controles e clique para pixelizar.";
            pixelSizeSlider.dispatchEvent(new Event('input'));
        };
        originalImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

pixelSizeSlider.addEventListener('input', () => {
    const width = pixelSizeSlider.value;
    pixelSizeValue.textContent = width;
    if (originalImage) {
        const aspectRatio = originalImage.height / originalImage.width;
        const height = Math.round(width * aspectRatio);
        pixelSizeValueHeight.textContent = height;
    } else {
         pixelSizeValueHeight.textContent = width;
    }
});

colorCountSlider.addEventListener('input', () => {
    colorCountValue.textContent = colorCountSlider.value;
});

processBtn.addEventListener('click', () => {
    if (!originalImage) {
        alert("Por favor, envie uma imagem primeiro.");
        return;
    }
    placeholder.classList.add('hidden');
    outputArea.classList.add('hidden');
    loader.style.display = 'flex';
    setTimeout(processImage, 50);
});

// --- Funções de Processamento da Imagem ---

function processImage() {
    const numPixelsWide = parseInt(pixelSizeSlider.value);
    const aspectRatio = originalImage.height / originalImage.width;
    const numPixelsHigh = Math.round(numPixelsWide * aspectRatio);
    
    sourceCanvas.width = originalImage.width;
    sourceCanvas.height = originalImage.height;
    sourceCtx.drawImage(originalImage, 0, 0);

    const k = parseInt(colorCountSlider.value);
    const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const pixels = getPixels(imageData);
    const palette = getPalette(pixels, k);
    const mappedPixels = mapPixelsToPalette(pixels, palette);

    const pixelWidth = Math.ceil(originalImage.width / numPixelsWide);
    const pixelHeight = Math.ceil(originalImage.height / numPixelsHigh);
    const POINT_SIZE = 10;
    outputCanvas.width = numPixelsWide * POINT_SIZE;
    outputCanvas.height = numPixelsHigh * POINT_SIZE;

    // NOVO: Objeto para contar as cores
    const colorCounts = {};
    palette.forEach(color => colorCounts[rgbToHex(color)] = 0);

    for (let y = 0; y < numPixelsHigh; y++) {
        for (let x = 0; x < numPixelsWide; x++) {
            const sourceX = Math.floor(x * pixelWidth);
            const sourceY = Math.floor(y * pixelHeight);
            const dominantColor = getDominantColor(mappedPixels, sourceX, sourceY, pixelWidth, pixelHeight, originalImage.width, palette);
            
            outputCtx.fillStyle = `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`;
            outputCtx.fillRect(x * POINT_SIZE, y * POINT_SIZE, POINT_SIZE, POINT_SIZE);

            // NOVO: Contabiliza a cor usada
            const hexColor = rgbToHex(dominantColor);
            colorCounts[hexColor]++;
        }
    }

    // NOVO: Chama a função para mostrar a paleta na tela
    displayPalette(colorCounts);

    loader.style.display = 'none';
    outputArea.classList.remove('hidden');
}

// --- NOVO: Função para exibir a paleta ---
function displayPalette(colorCounts) {
    paletteContainer.innerHTML = ''; // Limpa a paleta anterior
    
    // Ordena as cores pela quantidade de pixels, da mais usada para a menos usada
    const sortedColors = Object.entries(colorCounts).sort(([, a], [, b]) => b - a);

    for (const [hex, count] of sortedColors) {
        if (count === 0) continue; // Não mostra cores que não foram usadas
        
        const color = hexToRgb(hex);
        // Escolhe a cor do texto (preto ou branco) para melhor contraste com o fundo
        const textColor = (color.r * 0.299 + color.g * 0.587 + color.b * 0.114) > 186 ? '#000000' : '#FFFFFF';

        const paletteItem = document.createElement('div');
        paletteItem.className = 'p-2 rounded-lg shadow flex flex-col items-center justify-center text-center';
        paletteItem.style.backgroundColor = hex;
        paletteItem.style.color = textColor;
        
        paletteItem.innerHTML = `
            <span class="font-semibold text-sm">${hex}</span>
            <span class="text-xs">${count} pontos</span>
        `;
        paletteContainer.appendChild(paletteItem);
    }
}


// --- Algoritmos de Quantização de Cores (k-means simplificado) ---
function getPixels(imageData) { const pixels = []; for (let i = 0; i < imageData.data.length; i += 4) { pixels.push([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]]); } return pixels; }
function getPalette(pixels, k) { let centroids = []; for (let i = 0; i < k; i++) { centroids.push(pixels[Math.floor(Math.random() * pixels.length)]); } for (let iter = 0; iter < 10; iter++) { const clusters = Array.from({ length: k }, () => []); pixels.forEach(pixel => { let minDistance = Infinity; let closestCentroidIndex = 0; centroids.forEach((centroid, index) => { const distance = colorDistance(pixel, centroid); if (distance < minDistance) { minDistance = distance; closestCentroidIndex = index; } }); clusters[closestCentroidIndex].push(pixel); }); centroids = clusters.map(cluster => { if (cluster.length === 0) { return pixels[Math.floor(Math.random() * pixels.length)]; } const sum = cluster.reduce((acc, pixel) => [acc[0] + pixel[0], acc[1] + pixel[1], acc[2] + pixel[2]], [0, 0, 0]); return [Math.round(sum[0] / cluster.length), Math.round(sum[1] / cluster.length), Math.round(sum[2] / cluster.length)]; }); } return centroids; }
function mapPixelsToPalette(pixels, palette) { return pixels.map(pixel => { let minDistance = Infinity; let closestColor = palette[0]; palette.forEach(color => { const distance = colorDistance(pixel, color); if (distance < minDistance) { minDistance = distance; closestColor = color; } }); return closestColor; }); }
function getDominantColor(mappedPixels, startX, startY, width, height, imageWidth, palette) { const colorCounts = {}; palette.forEach(color => colorCounts[color.join(',')] = 0); for (let y = startY; y < startY + height; y++) { for (let x = startX; x < startX + width; x++) { const index = y * imageWidth + x; if (mappedPixels[index]) { const colorKey = mappedPixels[index].join(','); colorCounts[colorKey]++; } } } let dominantColorKey = Object.keys(colorCounts)[0]; let maxCount = 0; for (const colorKey in colorCounts) { if (colorCounts[colorKey] > maxCount) { maxCount = colorCounts[colorKey]; dominantColorKey = colorKey; } } return dominantColorKey.split(',').map(Number); }
function colorDistance(c1, c2) { const dr = c1[0] - c2[0]; const dg = c1[1] - c2[1]; const db = c1[2] - c2[2]; return dr * dr + dg * dg + db * db; }

// --- Funções Utilitárias para Cores ---
function rgbToHex(rgb) {
    return "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1).toUpperCase();
}
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}
