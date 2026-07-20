jQuery(window).on('elementor/frontend/init', function () {
    // === Video Popup Button Animation ===
    elementorFrontend.hooks.addAction('frontend/element_ready/global', function ($scope, $) {
        let $popupBtn = $scope.find('.pt-popup-animation');
        let $container = $scope.find('.pt-video-popup-img');

        // Skip if not found
        if ($popupBtn.length === 0 || $container.length === 0) return;

        let mouseX = 0, mouseY = 0;
        let btnX = 0, btnY = 0;
        let followSpeed = 0.1; // smaller = smoother

        $container.on('mousemove', function (e) {
            let offset = $container.offset();
            mouseX = e.pageX - offset.left;
            mouseY = e.pageY - offset.top;
        });

        $container.on('mouseenter', function (e) {
            $(this).css('cursor', 'none');
            $popupBtn.stop(true, true).fadeIn(150);

            // Position popup at mouse entry
            let offset = $container.offset();
            mouseX = e.pageX - offset.left;
            mouseY = e.pageY - offset.top;
            btnX = mouseX;
            btnY = mouseY;
            $popupBtn.css({ left: btnX + 'px', top: btnY + 'px' });
        });

        $container.on('mouseleave', function () {
            $(this).css('cursor', 'default');
            $popupBtn.stop(true, true).fadeOut(150);
        });

        function updatePosition() {
            btnX += (mouseX - btnX) * followSpeed;
            btnY += (mouseY - btnY) * followSpeed;

            $popupBtn.css({
                left: btnX + 'px',
                top: btnY + 'px'
            });

            requestAnimationFrame(updatePosition);
        }

        updatePosition();
    });

    // === Progress Bar Animation ===
    elementorFrontend.hooks.addAction('frontend/element_ready/global', function ($scope, $) {
        $scope.find('.pt-progress-bar > span').each(function () {
            var app_slider = jQuery('.pt-progressbar-box');
            var progress_bar = jQuery(this);
            var width = progress_bar.data('percent');

            // Init plugin
            progress_bar.progressBar({
                shadow: false,
                animation: true,
                height: app_slider.data('h'),
                percentage: false,
                border: false,
                animateTarget: true
            });

            // Animate bar
            progress_bar.css({ 'transition': 'width 2s' });
            setTimeout(function () {
                progress_bar.css('width', width + '%');
            }, 500);

            // Animate text value (scoped)
            progress_bar.closest('.pt-progressbar-content').find('.progress-value').css({
                'transition': 'margin 2s'
            }).each(function () {
                var progressValue = jQuery(this);
                setTimeout(function () {
                    progressValue.css('margin-left', width + 'px').fadeIn();
                }, 500);
            });

            // Animate tooltip (only for style-3)
            progress_bar.closest('.pt-progressbar-content').find('.progress-tooltip').each(function () {
                var progressTooltip = jQuery(this);
                setTimeout(function () {
                    progressTooltip.css('margin-left', width + 'px').fadeIn();
                }, 500);
            });
        });
    });
});