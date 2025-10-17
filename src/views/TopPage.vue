<template>
	<div class="top-page">
			<div class="controls">
				<label>
					n:
					<input type="number" v-model.number="n" min="1" />
				</label>
				<button @click="generate">Generate (random text)</button>
				<button @click="reset">Reset</button>
			</div>
		<div class="canvas-wrap" ref="wrapRef">
			<canvas ref="canvasRef" @click="handleClick"></canvas>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onBeforeUnmount, defineExpose } from 'vue'

const n = ref<number>(21)
const matrix = ref<boolean[][]>([])
const textList = ['hello', 'good', 'qrcode']
const text = ref<string>(textList[0])

let qrcodeLib: any = null

async function ensureQRCodeLib() {
	if (qrcodeLib) return qrcodeLib
	try {
		qrcodeLib = (await import('qrcode-generator'))
		return qrcodeLib
	} catch (err) {
		console.warn('qrcode-generator not installed; generate() will be unavailable', err)
		qrcodeLib = null
		return null
	}
}
const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapRef = ref<HTMLElement | null>(null)

let dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

function initMatrix() {
	matrix.value = Array.from({ length: n.value }, () => Array.from({ length: n.value }, () => false))
}

function draw() {
	const canvas = canvasRef.value
	if (!canvas) return
	const ctx = canvas.getContext('2d')
	if (!ctx) return

	// CSS size
	const rect = canvas.getBoundingClientRect()
	const cssW = rect.width
	const cssH = rect.height

	// Resize backing store for high-DPI
	canvas.width = Math.round(cssW * dpr)
	canvas.height = Math.round(cssH * dpr)
	canvas.style.width = `${cssW}px`
	canvas.style.height = `${cssH}px`

	// Map drawing units to CSS pixels for easier coordinates
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

	// background
	ctx.fillStyle = '#ffffff'
	ctx.fillRect(0, 0, cssW, cssH)

	const cellW = cssW / n.value
	const cellH = cssH / n.value

	// draw cells
	for (let y = 0; y < n.value; y++) {
		for (let x = 0; x < n.value; x++) {
			ctx.fillStyle = matrix.value[y][x] ? '#000000' : '#ffffff'
			// use Math.ceil to avoid hairline gaps
			ctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH))
		}
	}

	// subtle grid lines for editing clarity
	ctx.strokeStyle = 'rgba(0,0,0,0.12)'
	ctx.lineWidth = 1
	for (let i = 0; i <= n.value; i++) {
		const px = i * cellW
		ctx.beginPath()
		ctx.moveTo(px + 0.5, 0)
		ctx.lineTo(px + 0.5, cssH)
		ctx.stroke()

		const py = i * cellH
		ctx.beginPath()
		ctx.moveTo(0, py + 0.5)
		ctx.lineTo(cssW, py + 0.5)
		ctx.stroke()
	}
}

function fitCanvasSquare() {
	// Make canvas square based on the container width
	const wrap = wrapRef.value
	const canvas = canvasRef.value
	if (!wrap || !canvas) return
	const rect = wrap.getBoundingClientRect()
	const size = rect.width // use width to make square; you can change to min(width,height)
	canvas.style.width = `${size}px`
	canvas.style.height = `${size}px`
	draw()
}

function handleClick(e: MouseEvent) {
	const canvas = canvasRef.value
	if (!canvas) return
	const rect = canvas.getBoundingClientRect()
	const cx = e.clientX - rect.left
	const cy = e.clientY - rect.top
	const cellW = rect.width / n.value
	const x = Math.floor(cx / cellW)
	const y = Math.floor(cy / cellW)
	toggleCell(x, y)
}

function toggleCell(x: number, y: number) {
	if (x < 0 || y < 0 || x >= n.value || y >= n.value) return
	matrix.value[y][x] = !matrix.value[y][x]
	draw()
}

function setCell(x: number, y: number, value: boolean) {
	if (x < 0 || y < 0 || x >= n.value || y >= n.value) return
	matrix.value[y][x] = value
	draw()
}

function reset() {
	initMatrix()
	draw()
}

// Generate QR code
async function generate() {
		const lib = await ensureQRCodeLib()
	if (!lib) {
		alert('qrcode-generator is not installed. Run `npm install qrcode-generator` to enable generation.')
		return
	}

	text.value = textList[Math.floor(Math.random() * textList.length)]

	let QRCodeClass: any = lib
	if (lib.default) QRCodeClass = lib.default

	// qrcode-generator API: QRCode(typeNumber, errorCorrectionLevel)
	const qr = QRCodeClass(0, 'L')
	qr.addData(text.value)
	qr.make()

	const moduleCount = qr.getModuleCount()

	n.value = moduleCount
	matrix.value = Array.from({ length: moduleCount }, () => Array.from({ length: moduleCount }, () => false))

	for (let y = 0; y < moduleCount; y++) {
		for (let x = 0; x < moduleCount; x++) {
			const dark = qr.isDark(y, x)
			if (typeof dark === 'boolean') matrix.value[y][x] = dark
			else matrix.value[y][x] = !!qr.isDark(x, y)
		}
	}

	nextTick(() => draw())
}

// expose programmatic API
defineExpose({ setCell, toggleCell, getMatrix: () => matrix.value })

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
	initMatrix()
	nextTick(() => {
		fitCanvasSquare()
	})

	// respond to container resizes
	if (typeof ResizeObserver !== 'undefined' && wrapRef.value) {
		resizeObserver = new ResizeObserver(() => fitCanvasSquare())
		resizeObserver.observe(wrapRef.value)
	} else {
		window.addEventListener('resize', fitCanvasSquare)
	}
})

onBeforeUnmount(() => {
	if (resizeObserver && wrapRef.value) resizeObserver.unobserve(wrapRef.value)
	else window.removeEventListener('resize', fitCanvasSquare)
})

watch(n, (nv, ov) => {
	// reinitialize matrix when n changes
	initMatrix()
	nextTick(() => fitCanvasSquare())
})
</script>

<style scoped>
.top-page {
	padding: 16px;
}
.controls {
	margin-bottom: 12px;
	display: flex;
	gap: 8px;
	align-items: center;
}
.canvas-wrap {
	width: 640px;
	max-width: 100%;
}
canvas {
	display: block;
	width: 100%;
	height: auto;
	background: white;
	touch-action: manipulation;
}
</style>