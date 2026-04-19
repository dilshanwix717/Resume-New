// assets/scripts/Controllers/ErrorNotificationController.ts

import {
  _decorator,
  Component,
  Node,
  Label,
  UIOpacity,
  tween,
  Vec3,
  Button,
} from "cc";
import { EventBus } from "../core/EventBus";
import { GameEvent } from "../core/GameEvents";

const { ccclass, property } = _decorator;

/**
 * ErrorNotificationController
 *
 * Attach this component to a notification banner node in the scene.
 * The node should contain:
 *   - A Label child for the error message text
 *   - (Optional) A close Button child to dismiss manually
 *
 * The banner starts hidden and slides/fades in when an error event is
 * emitted, then auto-dismisses after a configurable duration.
 * If a new error arrives while one is already showing, the current
 * message is replaced immediately (no stacking to keep UX clean).
 *
 * Usage:
 *   EventBus.emit(GameEvent.SHOW_ERROR_NOTIFICATION, { message: "..." });
 */
@ccclass("ErrorNotificationController")
export class ErrorNotificationController extends Component {
  @property({ type: Label, tooltip: "Label used to display the error message" })
  messageLabel: Label = null!;

  @property({
    type: Button,
    tooltip: "Optional close button to dismiss the notification",
  })
  closeButton: Button | null = null;

  @property({
    tooltip: "Seconds to keep the notification visible before auto-dismiss",
  })
  displayDuration: number = 4;

  @property({ tooltip: "Fade-in duration in seconds" })
  fadeInDuration: number = 0.25;

  @property({ tooltip: "Fade-out duration in seconds" })
  fadeOutDuration: number = 0.3;

  @property({
    tooltip: "Slide offset Y (pixels) – banner slides down from this offset",
  })
  slideOffsetY: number = 60;

  private uiOpacity: UIOpacity = null!;
  private originalPosition: Vec3 = new Vec3();
  private autoDismissTimer: any = null;

  onLoad(): void {
    // Ensure the node has a UIOpacity component for tween control
    this.uiOpacity =
      this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);

    // Save the authored position as the "visible" position
    this.originalPosition = this.node.position.clone();

    // Start hidden
    this.node.active = false;
    this.uiOpacity.opacity = 0;

    // Listen for error events
    EventBus.on(
      GameEvent.SHOW_ERROR_NOTIFICATION,
      this.showNotification.bind(this),
    );

    // Optional close button
    if (this.closeButton) {
      this.closeButton.node.on(
        Button.EventType.CLICK,
        this.dismissNotification,
        this,
      );
    }
  }

  /**
   * Show the error notification with the given payload.
   * Replaces any currently visible notification.
   */
  private showNotification(payload: { message: string }): void {
    if (!payload?.message) return;

    // Cancel any pending auto-dismiss
    this.cancelAutoDismiss();

    // Stop any running tweens on this node & its opacity component
    tween(this.node).stop();
    tween(this.uiOpacity).stop();

    // Set message text
    if (this.messageLabel) {
      this.messageLabel.string = payload.message;
    }

    // Prepare start state: offset above final position, fully transparent
    const startPos = new Vec3(
      this.originalPosition.x,
      this.originalPosition.y + this.slideOffsetY,
      this.originalPosition.z,
    );
    this.node.setPosition(startPos);
    this.uiOpacity.opacity = 0;
    this.node.active = true;

    // Slide + fade in
    tween(this.node)
      .to(
        this.fadeInDuration,
        { position: this.originalPosition },
        { easing: "cubicOut" },
      )
      .start();

    tween(this.uiOpacity).to(this.fadeInDuration, { opacity: 255 }).start();

    // Schedule auto-dismiss
    this.autoDismissTimer = setTimeout(() => {
      this.dismissNotification();
    }, this.displayDuration * 1000);
  }

  /**
   * Dismiss (fade-out + hide) the notification.
   */
  private dismissNotification(): void {
    this.cancelAutoDismiss();

    // Stop any running tweens
    tween(this.node).stop();
    tween(this.uiOpacity).stop();

    // Fade out, then deactivate
    tween(this.uiOpacity)
      .to(this.fadeOutDuration, { opacity: 0 })
      .call(() => {
        this.node.active = false;
      })
      .start();
  }

  /**
   * Cancel the auto-dismiss timer if one is pending.
   */
  private cancelAutoDismiss(): void {
    if (this.autoDismissTimer !== null) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }

  onDestroy(): void {
    this.cancelAutoDismiss();

    if (this.closeButton) {
      this.closeButton.node.off(
        Button.EventType.CLICK,
        this.dismissNotification,
        this,
      );
    }
  }
}
