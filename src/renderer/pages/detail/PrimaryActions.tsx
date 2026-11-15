import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { PlayIcon } from '../../components/icons';
import { playLibraryItem } from '../../services/media/mediaService';

export function PrimaryActions({ targetId, label }: { targetId: string | null; label: string }) {
    const [pending, setPending] = useState(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
        }
    }, []);

    return (
        <div className="detail-actions">
            <Button
                variant="primary"
                iconLeft={<PlayIcon size={14} />}
                disabled={!targetId}
                onClick={() => {
                    if (!targetId) {
                        return;
                    }
                    playLibraryItem(targetId);
                    setPending(true);
                    if (timerRef.current !== null) {
                        window.clearTimeout(timerRef.current);
                    }
                    timerRef.current = window.setTimeout(() => setPending(false), 2000);
                }}
            >
                {pending ? '已发起播放…' : label}
            </Button>
        </div>
    );
}
