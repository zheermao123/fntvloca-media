function greetingForHour(hour: number): string {
    if (hour < 6) {
        return '夜深了';
    }
    if (hour < 12) {
        return '早上好';
    }
    if (hour < 18) {
        return '下午好';
    }
    return '晚上好';
}

export function HomeHeader() {
    const greeting = greetingForHour(new Date().getHours());
    return (
        <div className="home-header">
            <h2 className="home-header__greeting">{greeting}，欢迎回来</h2>
            <p className="home-header__hint">浏览本地媒体库，继续上次观看，或发现最近入库的内容。</p>
        </div>
    );
}
