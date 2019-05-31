import { GResLoader } from "./LDataType";
import { Logger } from "./Logger";

type AnimationPlayFinished = (error: Error) => void;

export interface AnimationPlayOptions {
    onFinished?: AnimationPlayFinished;
}

interface AnimationHolder {
    node?: cc.Node;
    prefab?: cc.Prefab;
    prefabName?: string;
}

/**
 * 简单的动画管理，主要是cache
 */
export class AnimationMgr {
    public readonly loader: GResLoader;

    public readonly map: { [key: string]: AnimationHolder } = {};

    public constructor(loader: GResLoader) {
        this.loader = loader;
    }

    public async coPlay(prefabName: string, mountNode: cc.Node, options?: AnimationPlayOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const cb = (error: Error): void => {
                if (error !== null) {
                    Logger.debug("Animation.coPlay error:", error);
                }

                resolve();
            };

            let op = options;
            if (op === undefined && op === null) {
                op = {};
                op.onFinished = cb;
            }

            this.play(prefabName, mountNode, options);
        });
    }

    public play(prefabName: string, mountNode: cc.Node, options?: AnimationPlayOptions): void {
        const cb = (error: Error) => {
            if (options !== undefined &&
                options.onFinished !== undefined && options.onFinished !== null) {
                options.onFinished(error);
            }
        };

        this.getAnimationHolder(prefabName, (error, holder) => {
            if (error !== null) {
                Logger.debug("AnimationMgr.play failed:", error);
                cb(error);
            } else {
                // play animation
                const n = holder.node;
                const animation = n.getComponent(cc.Animation);
                if (animation === null) {
                    cb(new Error(`${prefabName} has no animation component`));

                    return;
                }

                n.removeFromParent();
                mountNode.addChild(n);

                animation.off(cc.Animation.EventType.FINISHED);
                animation.stop();
                animation.play();

                animation.on(cc.Animation.EventType.FINISHED, () => {
                    cb(null);
                });
            }
        });
    }

    public getAnimationHolder(prefabName: string, onCompleted: (error: Error, holder: AnimationHolder) => void): void {
        const holder = this.map[prefabName];
        if (holder !== undefined) {
            onCompleted(null, holder);
        } else {
            this.loader.loadPrefab(prefabName, (error, res) => {
                if (error !== null) {
                    onCompleted(error, null);
                } else {
                    const holderNew: AnimationHolder = {};
                    holderNew.node = cc.instantiate(res);
                    holderNew.prefab = res;
                    holderNew.prefabName = prefabName;

                    this.map[prefabName] = holderNew;
                    onCompleted(null, holderNew);
                }
            });
        }
    }
}