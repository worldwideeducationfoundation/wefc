/*

Template: Donexa - Charity & Donation WordPress Theme
Author: peacefulqode.com
Version: 1.0
Worldwide Education Fund Canada

NOTE: This is main javasctipt file of template.

*/

/*====================================
[  Table of contents  ]
======================================
==> Page Loader
==> Search Button
==> Sidebar Toggle
==> Sticky Header
==> Back To Top
======================================
[ End table content ]
======================================
*/

(function ($) {
    "use strict";

    $(window).on('load', function () {

        /*------------------------
                Page Loader
        --------------------------*/
        setTimeout(function () {
            var $preloader = $("#pt-loading");
            $preloader.addClass("hide");

            setTimeout(function () {
                $preloader.remove();
            }, 500);

        }, 500);


        /*------------------------
                Search Button
        --------------------------*/
        $(document).on('click', '#pt-seacrh-btn', function () {
            $('.pt-search-form').slideToggle();
            $('.pt-search-form').toggleClass('pt-form-show');

            if ($('.pt-search-form').hasClass("pt-form-show")) {
                $(this).html('<i class="fa fa-times"></i>');
            } else {
                $(this).html('<i class="fa fa-search"></i>');
            }
        });


        /*------------------------
                Sidebar Toggle
        --------------------------*/
        $(document).on('click', "#pt-toggle-btn", function () {
            $('#pt-sidebar-menu-contain').toggleClass("active");
        });

        $(document).on('click', '.pt-toggle-btn', function () {
            $('body').addClass('pt-siderbar-open');
        });

        $(document).on('click', '.pt-close', function () {
            $('body').removeClass('pt-siderbar-open');
        });


        /*------------------------
                Sticky Header
        --------------------------*/
        (function () {

            var lastScrollTop = 0;
            var header = $('.pt-bottom-header, .pt-has-sticky');
            var startSticky = 300;

            $(window).on('scroll', function () {

                var scrollTop = $(this).scrollTop();

                // Activate sticky only after 300px
                if (scrollTop > startSticky) {

                    if (scrollTop < lastScrollTop) {
                        // scrolling UP → show header (bottom → top)
                        header
                            .addClass('pt-header-show')
                            .removeClass('pt-header-hide');
                    } else {
                        // scrolling DOWN → hide header (top → bottom)
                        header
                            .addClass('pt-header-hide')
                            .removeClass('pt-header-show');
                    }

                } else {
                    // before sticky point → keep visible
                    header
                        .addClass('pt-header-show')
                        .removeClass('pt-header-hide');
                }

                lastScrollTop = scrollTop;
            });

        })();


        /*------------------------
                Back To Top
        --------------------------*/
        $(document).ready(function () {

            var progressPath = document.querySelector('.progress-wrap path');
            var pathLength = progressPath.getTotalLength();

            progressPath.style.transition = progressPath.style.WebkitTransition = 'none';
            progressPath.style.strokeDasharray = pathLength + ' ' + pathLength;
            progressPath.style.strokeDashoffset = pathLength;
            progressPath.getBoundingClientRect();

            progressPath.style.transition = progressPath.style.WebkitTransition =
                'stroke-dashoffset 10ms linear';

            var updateProgress = function () {
                var scroll = $(window).scrollTop();
                var height = $(document).height() - $(window).height();
                var progress = pathLength - (scroll * pathLength / height);
                progressPath.style.strokeDashoffset = progress;
            };

            updateProgress();

            $(window).on('scroll', updateProgress);

            var offset = 50;
            var duration = 550;

            $(document).on('scroll', function () {
                if ($(this).scrollTop() > offset) {
                    $('.progress-wrap').addClass('active-progress');
                } else {
                    $('.progress-wrap').removeClass('active-progress');
                }
            });

            $(document).on('click', '.progress-wrap', function (event) {
                event.preventDefault();
                $('html, body').animate({ scrollTop: 0 }, duration);
                return false;
            });

        });

    });

})(jQuery);