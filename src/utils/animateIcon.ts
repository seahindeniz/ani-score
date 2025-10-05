export function animateIcon() {
  function createAnimatedIcon() {
    const canvas = new OffscreenCanvas(16, 16)
    const context = canvas.getContext('2d')!

    // Color sequences from the animated SVG (20-second cycle)
    const gradientStart = [
      '#f857a6',
      '#667eea',
      '#56ab2f',
      '#f2994a',
      '#a044ff',
      '#4facfe',
      '#11998e',
      '#2c3e50',
      '#eb3349',
      '#134e5e',
      '#ff512f',
      '#f857a6',
    ]

    const gradientEnd = [
      '#ff5858',
      '#764ba2',
      '#a8e063',
      '#f2c94c',
      '#6a3093',
      '#00f2fe',
      '#38ef7d',
      '#3498db',
      '#f45c43',
      '#71b280',
      '#dd2476',
      '#ff5858',
    ]

    let animationFrame = 0
    const totalFrames = gradientStart.length * 60 // ~1 second per color at 60fps

    function animate() {
      context.clearRect(0, 0, 16, 16)

      // Calculate current color indices and interpolation factor
      const colorIndex = Math.floor(animationFrame / 60) % gradientStart.length
      const nextColorIndex = (colorIndex + 1) % gradientStart.length
      const t = (animationFrame % 60) / 60

      // Interpolate colors
      const startColor = interpolateColor(gradientStart[colorIndex], gradientStart[nextColorIndex], t)
      const endColor = interpolateColor(gradientEnd[colorIndex], gradientEnd[nextColorIndex], t)

      // Create gradient
      const gradient = context.createLinearGradient(0, 0, 16, 16)
      gradient.addColorStop(0, startColor)
      gradient.addColorStop(1, endColor)

      // Draw rounded rectangle background (scaled down from 64x64 to 16x16)
      context.fillStyle = gradient
      roundRect(context, 0, 0, 16, 16, 3)
      context.fill()

      // Draw outer circle (scaled down)
      context.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      context.lineWidth = 0.75
      context.beginPath()
      context.arc(8, 8, 5.25, 0, Math.PI * 2)
      context.stroke()

      // Draw progress circle
      context.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      context.lineWidth = 0.75
      context.lineCap = 'round'
      context.beginPath()
      context.arc(8, 8, 5.25, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 1.67), false)
      context.stroke()

      // Draw inner circle
      context.strokeStyle = 'rgba(255, 215, 0, 0.4)'
      context.lineWidth = 0.6
      context.beginPath()
      context.arc(8, 8, 4, 0, Math.PI * 2)
      context.stroke()

      // Draw inner progress circle
      context.strokeStyle = 'rgba(255, 215, 0, 0.95)'
      context.lineWidth = 0.6
      context.lineCap = 'round'
      context.beginPath()
      context.arc(8, 8, 4, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 1.5), false)
      context.stroke()

      // Draw star (scaled down)
      context.fillStyle = 'rgba(255, 255, 255, 0.95)'
      drawStar(context, 8, 8, 2.5)

      // Update icon
      const imageData = context.getImageData(0, 0, 16, 16)
      chrome.action.setIcon({ imageData })

      animationFrame = (animationFrame + 1) % totalFrames
      setTimeout(animate, 1000 / 60)
    }

    animate()
  }

  // Helper function to create rounded rectangle
  function roundRect(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }

  // Helper function to draw star
  function drawStar(ctx: OffscreenCanvasRenderingContext2D, cx: number, cy: number, radius: number) {
    const spikes = 5
    const outerRadius = radius
    const innerRadius = radius * 0.4

    ctx.beginPath()
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes - Math.PI / 2
      const r = i % 2 === 0 ? outerRadius : innerRadius
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r
      if (i === 0) {
        ctx.moveTo(x, y)
      }
      else {
        ctx.lineTo(x, y)
      }
    }
    ctx.closePath()
    ctx.fill()
  }

  // Helper function to interpolate between two hex colors
  function interpolateColor(color1: string, color2: string, t: number): string {
    const hex1 = color1.replace('#', '')
    const hex2 = color2.replace('#', '')

    const r1 = Number.parseInt(hex1.substr(0, 2), 16)
    const g1 = Number.parseInt(hex1.substr(2, 2), 16)
    const b1 = Number.parseInt(hex1.substr(4, 2), 16)

    const r2 = Number.parseInt(hex2.substr(0, 2), 16)
    const g2 = Number.parseInt(hex2.substr(2, 2), 16)
    const b2 = Number.parseInt(hex2.substr(4, 2), 16)

    const r = Math.round(r1 + (r2 - r1) * t)
    const g = Math.round(g1 + (g2 - g1) * t)
    const b = Math.round(b1 + (b2 - b1) * t)

    return `rgb(${r}, ${g}, ${b})`
  }

  createAnimatedIcon()
}
