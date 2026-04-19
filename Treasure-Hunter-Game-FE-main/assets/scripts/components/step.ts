import { _decorator, Component, Label, dragonBones } from 'cc';
import { stepAnimationState } from '../types/GameTypes';

const { ccclass, property } = _decorator;

const ANIMATION_LOOP_COUNT = 0;

@ccclass('step')
export class Step extends Component {
    @property(Label)
    stepMultiplierLabel: Label = null!;

    @property(dragonBones.ArmatureDisplay)
    stepAnimation: dragonBones.ArmatureDisplay = null!;

    setData(multiplier: number, index: number, crashPoint: number, cashOutPoint: number, hasCashOut = false): void {
        if (this.stepMultiplierLabel)
            this.stepMultiplierLabel.string = multiplier.toString();
        const animState =
            this.resolveAnimationState(
                index,
                crashPoint,
                cashOutPoint,
                hasCashOut,
            );
        this.stepAnimation?.playAnimation(animState, ANIMATION_LOOP_COUNT);
    }

    private resolveAnimationState(
        index: number,
        crashPoint: number,
        cashOutPoint: number,
        hasCashOut: boolean,
    ): stepAnimationState {
        if (index === crashPoint) {
            if (hasCashOut === true) {
                return stepAnimationState.STEPS_CRASH_STILL;
            }
            return stepAnimationState.STEPS_CRASH;
        }
        if (hasCashOut && index === cashOutPoint) {
            return stepAnimationState.STEPS_WIN;
        }
        if (hasCashOut && cashOutPoint < index && index < crashPoint) {
            return stepAnimationState.STEPS_DARK;
        }
        return index < crashPoint ? stepAnimationState.STEPS : stepAnimationState.STEPS_DARK;
    }

    onDestroy(): void {
        this.node.destroy();
    }
}
