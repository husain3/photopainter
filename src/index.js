/* global R */

const range = n =>
  Array.from(Array(n).keys())

export const inset = (x, y, w, h, dx, dy) =>
  [x + dx, y + dy, w - 2 * dx, h - 2 * dy]

const getImageData = () => {
  console.log('[getImageData]')
  const canvas = document.getElementById('input-image')
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return imageData
}

const imageDataFrom1Channel = (data, width, height) => {
  console.log('[imageDataFrom1Channel]')
  const cb = width * height * 4
  const array = new Uint8ClampedArray(cb)
  data.forEach((pixelValue, index) => {
    const base = index * 4
    array[base] = pixelValue
    array[base + 1] = pixelValue
    array[base + 2] = pixelValue
    array[base + 3] = 255
  })
  const imageData = new ImageData(array, width, height)
  return imageData
}

const imageDataFrom4Channels = (data, width, height) => {
  console.log('[imageDataFrom4Channels]')
  const array = new Uint8ClampedArray(data)
  console.log("IMAGE DATA 4")
  console.log(array)
  const imageData = new ImageData(array, width, height)
  return imageData
}

const drawOutputImage = (imageData, canvasId) => {
  console.log('[drawOutputImage]')
  const canvas = document.getElementById(canvasId)
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  ctx.putImageData(imageData, 0, 0)
  const outputImageOverlay = document.getElementById(`${canvasId}-overlay`)
  outputImageOverlay.width = imageData.width
  outputImageOverlay.height = imageData.height
}

const cropCells = (canvasId, cellsId, boundingBox) => {
  console.log('[cropCells]')

  const canvas = document.getElementById(canvasId)
  const ctx = canvas.getContext('2d')

  const cellsElement = document.getElementById(cellsId)

  const [bbx, bby, bbw, bbh] = inset(...boundingBox, 2, 2)
  const cellw = bbw / 9
  const cellh = bbh / 9
  for (const y of range(9)) {
    const row = document.createElement('div')
    const celly = bby + y * cellh
    for (const x of range(9)) {
      const cellx = bbx + x * cellw
      const imageData = ctx.getImageData(...inset(cellx, celly, cellw, cellh, 2, 2))
      const cellCanvas = document.createElement('canvas')
      cellCanvas.setAttribute('class', 'cell')
      cellCanvas.width = imageData.width
      cellCanvas.height = imageData.height
      cellCanvas.getContext('2d').putImageData(imageData, 0, 0)
      row.appendChild(cellCanvas)
    }
    cellsElement.appendChild(row)
  }
}

const clearCanvas = canvasId => {
  const canvas = document.getElementById(canvasId)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

const deleteChildren = elementId => {
  const parent = document.getElementById(elementId)
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild)
  }
}

const reset = () => {
  clearCanvas('output-image-1')
  clearCanvas('output-image-1-overlay')
  clearCanvas('output-image-2')
  clearCanvas('output-image-2-overlay')
  deleteChildren('cells-1')
  deleteChildren('cells-2')
  const elapsedTimeRow = document.getElementById('elapsed-time-row')
  elapsedTimeRow.style.display = 'none';
}

const loadInputImage = async index => {
  console.log('[loadInputImage]')
  const inputImageSelector = document.getElementById('input-image-selector')
  const imageUrl = inputImageSelector.options[index].value
  const image = new Image()
  await new Promise(resolve => {
    image.onload = resolve
    image.src = imageUrl
  })
  const canvas = document.getElementById('input-image')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0, image.width, image.height)
  const inputImageOverlay = document.getElementById('input-image-overlay')
  inputImageOverlay.width = image.width
  inputImageOverlay.height = image.height
  reset()
}

const unpackImage = (module, [width, height, channels, addr]) => {
  console.log('[unpackImage]')
  console.log(height)
  const cb = width * height * channels
  const data = module.HEAPU8.slice(addr, addr + cb)
  return channels === 1
    ? imageDataFrom1Channel(data, width, height)
    : imageDataFrom4Channels(data, width, height)
}

const unpackProcessImageResult1 = (module, addr) => {
  const NUM_INT_FIELDS = 4
  const addr32 = addr / module.HEAP32.BYTES_PER_ELEMENT
  const data32 = module.HEAP32.slice(addr32, addr32 + NUM_INT_FIELDS)
  // const boundingBox = data32.slice(0, 4)
  const image1 = unpackImage(module, data32.slice(0, 4))
  // const image2 = unpackImage(module, data32.slice(8, 12))
  // const corners = unpackCorners(data32.slice(12, 20))
  // const contour = unpackContour(module, data32.slice(20, 22))
  return { image1 }
}

const onConvertImage = (module, convertImage) => () => {
  console.log('[onConvertImage]')
  reset()
  const { data, width, height } = getImageData()
  const array = new Uint8ClampedArray(data)
  console.log(array)
  const startTime = performance.now()
  const addr = convertImage(data, width, height)
  const endTime = performance.now()
  console.log(addr)
  const unpackedResult = unpackProcessImageResult1(module, addr)
  drawOutputImage(unpackedResult.image1, 'output-image-1')
  module._free(addr)
}

const wrapConvertImage = module => {
  console.log('[wrapConvertImage]')
  const ident = 'convertImage'
  const returnType = 'number'
  const argTypes = ['array', 'number', 'number']
  const convertImage = module.cwrap(ident, returnType, argTypes)
  return convertImage
}

const init = module => {
  console.log('[init]')
  const inputImageSelector = document.getElementById('input-image-selector')
  range(2).forEach(index => {
    const sudokuNumber = index + 1
    // const value = `/images/sudoku-${sudokuNumber}.png`
    const value = `/images/meme.png`
    const label = `Sudoku ${sudokuNumber}`
    const optionElement = document.createElement('option')
    optionElement.setAttribute('value', value)
    optionElement.innerText = label
    inputImageSelector.appendChild(optionElement)
  })
  loadInputImage(0)
  const convertImage = wrapConvertImage(module)
  console.log(convertImage)
  const convertImageBtn = document.getElementById('convert-image-btn')
  convertImageBtn.addEventListener('click', onConvertImage(module, convertImage))
}

const main = async () => {
  window.createHelloModule().then(init)
}

main()
