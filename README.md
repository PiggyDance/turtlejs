# TurtleJS

[![npm version](https://img.shields.io/npm/v/@shlomil/turtlejs.svg)](https://www.npmjs.com/package/@shlomil/turtlejs)

A feature-rich JavaScript implementation of turtle graphics inspired by Python's `turtle` module. TurtleJS uses HTML canvas for rendering and supports animated drawing operations, coordinate transformations, and most features from Python's turtle graphics.

## Installation

### Using CDN
You can include TurtleJS in your project using a CDN. Add the following script tag to your HTML file:

```html
<script src="https://cdn.jsdelivr.net/npm/@shlomil/turtlejs@1.0.3/dist/turtle.umd.min.js"></script>
```
\- or -

```html
<script type="module">
    import {Turtle, Screen} from 'https://cdn.jsdelivr.net/npm/@shlomil/turtlejs@1.0.3/dist/turtle.esm.js';
</script>
```

### Using npm

```bash
npm install @shlomil/turtlejs
```

### Direct inclusion in HTML

You can include TurtleJS in your HTML file by adding the following script tag:

```html
<script src="node_modules/@shlomil/turtlejs/dist/turtle.umd.min.js"></script>
<script>
    turtlejs.export_turtle_globals()
    //...
</script>
```
### Import as a module

```javascript
<script type="module">
    // ES Module
    import { Turtle, Screen } from '/node_modules/@shlomil/turtlejs/dist/turtle.esm.js';
```

## Playground

You can try out TurtleJS in the [TurtleJS Playground](https://shlomil.github.io/turtlejs/examples/editor.html). The playground allows you to experiment with turtle graphics directly in your browser.

## Basic Usage

### HTML Script Tag
```html
<script src="node_modules/@shlomil/turtlejs/dist/turtle.umd.js"></script>
<script>
    turtlejs.export_turtle_globals()

    speed(8);
    teleport(-50,50)
    pencolor('blue');
    pensize(2);

    for (let i = 0; i < 4; i++) {
        forward(100);
        right(90);
    }
</script>
```

## Features

- **Full Turtle Movement**: Forward/backward movement, rotation, positioning
- **Pen Controls**: Color, width, up/down state
- **Fill Operations**: Fill shapes with colors
- **Animation**: Control drawing speed with smooth animations
- **Coordinate System**: Flexible world coordinate system
- **Shapes**: Multiple turtle shapes (arrow, turtle, square, etc.)
- **Text and Stamps**: Write text and create stamps
- **Event Handling**: Click and keyboard events
- **Undo Support**: Revert previous operations
- **optinal asnchronous API**: Use async/await for sequential actions

## API Reference

TurtleJS implements most methods from Python's turtle module:

### Movement
- `forward(distance)`, `fd(distance)`
- `backward(distance)`, `bk(distance)`, `back(distance)`
- `right(angle)`, `rt(angle)`
- `left(angle)`, `lt(angle)`
- `goto(x, y)`, `setpos(x, y)`, `setposition(x, y)`
- `setx(x)`, `sety(y)`
- `setheading(angle)`, `seth(angle)`
- `home()`
- `circle(radius, extent, steps)`

### Pen Control
- `pendown()`, `pd()`, `down()`
- `penup()`, `pu()`, `up()`
- `pensize(width)`, `width(width)`
- `pencolor(...color)`
- `fillcolor(...color)`
- `begin_fill()`, `end_fill()`

### State
- `hideturtle()`, `ht()`
- `showturtle()`, `st()`
- `isvisible()`
- `speed(speed)`

### More Advanced
- `write(text, move, align, font)`
- `dot(size, color)`
- `stamp()`, `clearstamp(stampid)`
- `undo()`

## Notes

- All drawing operations return Promises that resolve when the animation completes
- Use `await` with turtle operations for sequential execution
- Speed values range from 1 (slowest) to 10 (fastest), with 0 for instant drawing
- Colors accept names, hex values, RGB arrays, and more

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.