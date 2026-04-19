// assets/scripts/components/DropdownToggle.ts

import {
  _decorator,
  Component,
  Node,
  Button,
  Label,
  Vec3,
  director,
  UITransform,
  Vec2,
} from "cc";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";

const { ccclass, property } = _decorator;

@ccclass("DropdownToggle")
export class DropdownToggle extends Component {
  @property({ type: Node, tooltip: "The content panel to show/hide" })
  contentPanel: Node = null!;

  @property({ type: Label, tooltip: "Optional label to show current selection" })
  selectionLabel: Label = null!;

  @property({ type: Node, tooltip: "Arrow/indicator icon" })
  arrowIcon: Node = null!;

  @property({ tooltip: "Start with content visible" })
  startExpanded = true;

  @property({
    tooltip: "Collapse when this event fires (e.g., UI_DIFFICULTY_CHANGED)",
  })
  collapseOnEvent = "";

  @property({ tooltip: "Disable during active game rounds" })
  disableDuringRound = true;

  @property({ tooltip: "Close dropdown when clicking outside" })
  closeOnClickOutside = true;

  @property({
    tooltip: "Collapse when any button inside content panel is clicked",
  })
  collapseOnContentClick = true;

  private isExpanded = true;
  private toggleButton: Button = null!;
  private originalContentScale = new Vec3(1, 1, 1);
  private onGlobalTouchBound: ((event: any) => void) | null = null;
  private contentButtonListeners: { node: Node; callback: () => void }[] = [];

  onLoad() {
    this.toggleButton = this.getComponent(Button) ?? this.addComponent(Button)!;

    if (this.contentPanel) {
      this.originalContentScale = this.contentPanel.scale.clone();
    }

    this.node.on(Button.EventType.CLICK, this.toggle, this);

    this.setupEventListeners();

    if (this.collapseOnContentClick) {
      this.setupContentClickListeners();
    }

    this.isExpanded = this.startExpanded;
    this.applyState();
  }

  /* -------------------------------------------------------------------------- */
  /*                               Event Handling                               */
  /* -------------------------------------------------------------------------- */

  private setupEventListeners(): void {
    if (this.collapseOnEvent) {
      EventBus.on(this.collapseOnEvent as GameEvent, this.collapse.bind(this));
    }

    if (this.disableDuringRound) {
      EventBus.on(GameEvent.BET_PLACED, this.onRoundStarting.bind(this));
      EventBus.on(GameEvent.ROUND_ENDED, this.onRoundEnded.bind(this));
      EventBus.on(GameEvent.BET_FAILED, this.onRoundEnded.bind(this));
    }

    if (this.closeOnClickOutside) {
      this.setupGlobalTouchListener();
    }
  }

  private setupContentClickListeners(): void {
    if (!this.contentPanel) return;
    this.findButtonsRecursively(this.contentPanel);
  }

  private findButtonsRecursively(node: Node): void {
    for (const child of node.children) {
      const button = child.getComponent(Button);
      if (button) {
        const callback = () => this.collapse();
        child.on(Button.EventType.CLICK, callback, this);
        this.contentButtonListeners.push({ node: child, callback });
      }
      this.findButtonsRecursively(child);
    }
  }

  private setupGlobalTouchListener(): void {
    this.onGlobalTouchBound = this.onGlobalTouch.bind(this);
    const canvas = director.getScene()?.getChildByName("Canvas");
    canvas?.on(Node.EventType.TOUCH_END, this.onGlobalTouchBound, this);
  }

  private onGlobalTouch(event: any): void {
    if (!this.isExpanded) return;

    const point = event.getUILocation();

    if (this.isPointInsideNode(point, this.node)) return;
    if (
      this.contentPanel &&
      this.isPointInsideNodeOrChildren(point, this.contentPanel)
    ) {
      return;
    }

    this.collapse();
  }

  /* -------------------------------------------------------------------------- */
  /*                               State Control                                 */
  /* -------------------------------------------------------------------------- */

  public toggle(): void {
    // Emit button click for audio
    EventBus.emit(GameEvent.UI_BUTTON_CLICKED);
    
    this.isExpanded = !this.isExpanded;
    this.applyState();
  }

  public expand(): void {
    if (!this.isExpanded) {
      this.isExpanded = true;
      this.applyState();
    }
  }

  public collapse(): void {
    if (this.isExpanded) {
      this.isExpanded = false;
      this.applyState();
    }
  }

  public getIsExpanded(): boolean {
    return this.isExpanded;
  }

  public setSelectionText(text: string): void {
    if (this.selectionLabel) {
      this.selectionLabel.string = text;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.toggleButton.interactable = enabled;
  }

  private applyState(): void {
    if (!this.contentPanel) return;

    this.contentPanel.active = this.isExpanded;
    this.contentPanel.setScale(
      this.isExpanded
        ? this.originalContentScale
        : new Vec3(this.originalContentScale.x, 0, this.originalContentScale.z)
    );

    this.updateArrowRotation();
  }

  private updateArrowRotation(): void {
    if (!this.arrowIcon) return;

    // Up when expanded, down when collapsed
    const rotation = this.isExpanded ? 0 : 180;
    this.arrowIcon.setRotationFromEuler(0, 0, rotation);
  }

  /* -------------------------------------------------------------------------- */
  /*                               Geometry Utils                                */
  /* -------------------------------------------------------------------------- */

  private isPointInsideNodeOrChildren(point: Vec2, node: Node): boolean {
    if (this.isPointInsideNode(point, node)) return true;
    return node.children.some((child) =>
      this.isPointInsideNodeOrChildren(point, child)
    );
  }

  private isPointInsideNode(point: Vec2, node: Node): boolean {
    const ui = node.getComponent(UITransform);
    if (!ui) return false;

    const local = ui.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
    const size = ui.contentSize;
    const anchor = ui.anchorPoint;

    const left = -size.width * anchor.x;
    const right = size.width * (1 - anchor.x);
    const bottom = -size.height * anchor.y;
    const top = size.height * (1 - anchor.y);

    return (
      local.x >= left &&
      local.x <= right &&
      local.y >= bottom &&
      local.y <= top
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                                  Cleanup                                    */
  /* -------------------------------------------------------------------------- */

  private onRoundStarting(): void {
    this.setEnabled(false);
    this.collapse();
  }

  private onRoundEnded(): void {
    this.setEnabled(true);
  }

  onDestroy() {
    this.node.off(Button.EventType.CLICK, this.toggle, this);

    for (const { node, callback } of this.contentButtonListeners) {
      node.off(Button.EventType.CLICK, callback, this);
    }

    if (this.onGlobalTouchBound) {
      const canvas = director.getScene()?.getChildByName("Canvas");
      canvas?.off(Node.EventType.TOUCH_END, this.onGlobalTouchBound, this);
    }
  }
}
