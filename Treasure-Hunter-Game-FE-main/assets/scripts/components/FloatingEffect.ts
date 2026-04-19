import { _decorator, Component, Vec3 } from "cc";

const { ccclass, property } = _decorator;

@ccclass("FloatingEffect")
export class FloatingEffect extends Component {
  @property({ tooltip: "How far the object floats up and down" })
  floatHeight: number = 10;

  @property({ tooltip: "How fast the object floats (cycles per second)" })
  floatSpeed: number = 1;

  private startPosition: Vec3 = new Vec3();
  private elapsedTime: number = 0;

  onLoad(): void {
    this.startPosition = this.node.position.clone();
  }

  update(dt: number): void {
    this.elapsedTime += dt;

    // Use sine wave for smooth up/down motion
    const offsetY =
      Math.sin(this.elapsedTime * this.floatSpeed * Math.PI * 2) *
      this.floatHeight;

    this.node.setPosition(
      this.startPosition.x,
      this.startPosition.y + offsetY,
      this.startPosition.z,
    );
  }
}
