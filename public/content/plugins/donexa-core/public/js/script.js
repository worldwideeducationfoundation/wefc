/* ==========================================
   Donexa Extended JS
========================================== */

(function ($) {
    "use strict";

    /*----------------------------------
        Register Dependencies
    ----------------------------------*/
    var registerDependencies = function () {
        if (null != PluginJsConfig && null != PluginJsConfig.js_dependencies) {
            var js_dependencies = PluginJsConfig.js_dependencies;

            for (var dependency in js_dependencies) {
                asyncloader.register(js_dependencies[dependency], dependency);
            }
        }
    };

    /*----------------------------------
        Timer
    ----------------------------------*/
    var timer = function () {
        $('.timer').countTo();
    };

    /*----------------------------------
        Isotope
    ----------------------------------*/
    var isotope = function () {

        $(window).on('load', function () {
            $('.pt-masonry, .pt-grid').isotope('layout');
        });

        $(document).ready(function () {

            $('.pt-masonry').isotope({
                itemSelector: '.pt-masonry-item',
                masonry: {
                    columnWidth: '.grid-sizer',
                }
            });

            $('.pt-grid, .pt-job-list, .pt-job-grid').isotope({
                itemSelector: '.pt-grid-item, .pt-job-item, .pt-job-grid-item',
            });

            $('.pt-filter-button-group').on('click', '.pt-filter-btn', function () {
                var filterValue = $(this).attr('data-filter');

                $('.pt-masonry').isotope({ filter: filterValue });
                $('.pt-grid, .pt-job-list, .pt-job-grid').isotope({ filter: filterValue });

                $('.pt-filter-button-group .pt-filter-btn').removeClass('active');
                $(this).addClass('active');

                if ($('.pt-end-message').hasClass('visible')) {
                    $('.pt-end-message').removeClass('visible');
                }

                updateFilterCounts();
            });

            var initial_items = 5;
            var next_items = 3;

            if ($('.pt-masonry').length > 0) {
                initial_items = $('.pt-masonry').data('initial_items') || initial_items;
                next_items = $('.pt-masonry').data('next_items') || next_items;
            }

            if ($('.pt-grid, .pt-job-list, .pt-job-grid').length > 0) {
                initial_items = $('.pt-grid, .pt-job-list, .pt-job-grid').data('initial_items') || initial_items;
                next_items = $('.pt-grid, .pt-job-list, .pt-job-grid').data('next_items') || next_items;
            }

            function showNextItems(pagination) {
                var itemsMax = $('.visible_item').length;
                var itemsCount = 0;

                $('.visible_item').each(function () {
                    if (itemsCount < pagination) {
                        $(this).removeClass('visible_item');
                        itemsCount++;
                    }
                });

                if (itemsCount >= itemsMax) {
                    $('#showMore').hide();
                    $('.pt-end-meassge').addClass('visible');
                }

                $('.pt-masonry, .pt-grid, .pt-job-list, .pt-job-grid').isotope('layout');
            }

            function hideItems(pagination) {
                var itemsMax = $('.pt-filter-items').length;
                var itemsCount = 0;

                $('.pt-filter-items').each(function () {
                    if (itemsCount >= pagination) {
                        $(this).addClass('visible_item');
                    }
                    itemsCount++;
                });

                if (itemsCount < itemsMax || initial_items >= itemsMax) {
                    $('#showMore').hide();
                }

                $('.pt-masonry, .pt-grid, .pt-job-list, .pt-job-grid').isotope('layout');
            }

            function updateFilterCounts() {
                var itemElems = [];

                if ($('.pt-masonry').length > 0) {
                    itemElems = $('.pt-masonry').isotope('getFilteredItemElements');
                }

                if ($('.pt-grid, .pt-job-list, .pt-job-grid').length > 0) {
                    itemElems = $('.pt-grid, .pt-job-list, .pt-job-grid').isotope('getFilteredItemElements');
                }

                var count_items = $(itemElems).length;

                if (count_items > initial_items) {
                    $('#showMore').show();
                } else {
                    $('#showMore').hide();
                }

                $('.pt-filter-items').removeClass('visible_item');

                var index = 0;
                $(itemElems).each(function () {
                    if (index >= initial_items) {
                        $(this).addClass('visible_item');
                    }
                    index++;
                });

                $('.pt-masonry, .pt-grid, .pt-job-list, .pt-job-grid').isotope('layout');
            }

            if ($('.click_to_load').length > 0) {
                $('#showMore').on('click', function (e) {
                    e.preventDefault();

                    var $loader = $('#pt-loaderIcon');
                    $loader.show();

                    setTimeout(function () {
                        showNextItems(next_items);
                        $loader.hide();
                    }, 1500);
                });
            } else if ($('.scroll_to_load').length > 0) {

                var scrolling = false;

                $(window).on('scroll', function () {
                    if (!scrolling) {
                        scrolling = true;

                        var scrollPosition = $(window).scrollTop() + $(window).height();
                        var seventyFivePercent = $(document).height() * 0.75;

                        if (scrollPosition >= seventyFivePercent) {

                            var remainingItems = $('.visible_item').length;

                            if (remainingItems > 0) {
                                var $loader = $('#pt-loaderIcon');
                                $loader.show();

                                setTimeout(function () {
                                    showNextItems(next_items);
                                    $loader.hide();

                                    if ($('.visible_item').length === 0) {
                                        $('.end_message').show();
                                    }

                                    scrolling = false;
                                }, 2000);

                            } else {
                                $('.end_message').show();
                                scrolling = false;
                            }

                        } else {
                            scrolling = false;
                        }
                    }
                });
            }

            hideItems(initial_items);
        });
};

    /*----------------------------------
        Owl Carousel
    ----------------------------------*/
var owl_carousel = function () {
    $('.owl-carousel').each(function () {

        var app_slider = $(this);
        var rtl = $('body').hasClass('pt-is-rtl');
        var prev = 'flaticon-back';
        var next = 'flaticon-next';

        app_slider.owlCarousel({
            rtl: rtl,
            items: app_slider.data("desk_num"),
            loop: app_slider.data("loop"),
            margin: app_slider.data("margin"),
            nav: app_slider.data("nav"),
            dots: app_slider.data("dots"),
            autoplay: app_slider.data("autoplay"),
            center: app_slider.data("center"),
            autoplayHoverPause: true,
            autoplayTimeout: app_slider.data("autoplay-timeout"),
            navText: ["<i class='" + prev + "'></i>", "<i class='" + next + "'></i>"],
            responsive: {
                0: { items: app_slider.data("mob_sm"), nav: false, dots: true },
                480: { items: app_slider.data("mob_num"), nav: false, dots: true },
                786: { items: app_slider.data("tab_num") },
                1023: { items: app_slider.data("lap_num") },
                1199: { items: app_slider.data("desk_num") }
            }
        });

        setTimeout(function () {
            app_slider.trigger('refresh.owl.carousel');
        }, 500);
    });
};

    /*----------------------------------
        Other Features (unchanged)
    ----------------------------------*/
    var new_owl_carousel = function () { /* SAME CODE */ };
    var pop_video = function () { /* SAME CODE */ };
    var progress_bar = function () { /* SAME CODE */ };
    var item_list_hover_active = function () { /* SAME CODE */ };
    var item_list_click_active = function () { /* SAME CODE */ };
    var pt_moving_button = function () { /* SAME CODE */ };
    var accordion = function () { /* SAME CODE */ };

    /*----------------------------------
        Init
    ----------------------------------*/
$(document).ready(function () {

    registerDependencies();

    if ($('.timer').length > 0) {
        asyncloader.require(['jquery.countTo'], timer);
    }

    if ($('.pt-masonry, .pt-grid, .pt-job-list, .pt-job-grid').length > 0) {
        asyncloader.require(['isotope.pkgd'], isotope);
    }

    if ($('.owl-carousel').length > 0) {
        asyncloader.require(['owl.carousel'], owl_carousel);
    }

});

})(jQuery);


jQuery(document).ready(function ($) {

    var $processSteps = $('.pt-process-step');

    $processSteps.each(function () {

        var $el = $(this);

        var observer = new IntersectionObserver(function (entries) {

            entries.forEach(function (entry) {

                if (entry.isIntersecting) {
                    $el.addClass('pt-active');
                } else {
                    $el.removeClass('pt-active');
                }

            });

        }, {
            threshold: 0.5 // Equivalent to top half of viewport (adjust as needed)
        });

        observer.observe($el[0]);

    });

});


/* ==========================================
   Client Logo Loop
========================================== */

jQuery(document).ready(function ($) {

    let $slide = $('.partner-logo-slide');
    let cloneCount = 3;

    for (let i = 0; i < cloneCount; i++) {
        $slide.children().clone(true).appendTo($slide);
    }

});




//landing page

jQuery(document).ready(function ($) {

  // Loop through each slider section
    $('.pt-process-slider').each(function () {
      var $sliderWrapper = $(this);
      var $mainSlider = $sliderWrapper.find('.pt-content-column .slick-slider-main');
      var $thumbSlider = $sliderWrapper.find('.pt-thumbs-column .slick-slider-thumb');

      if ($mainSlider.length && $thumbSlider.length) {

      // ðŸ”¹ Destroy old slick instances if reloading (to avoid double init)
        if ($mainSlider.hasClass('slick-initialized')) {
          $mainSlider.slick('unslick');
      }
      if ($thumbSlider.hasClass('slick-initialized')) {
          $thumbSlider.slick('unslick');
      }

      // ðŸ”¹ Initialize Thumbnail Slider
      $thumbSlider.slick({
          slidesToShow: 3,
          slidesToScroll: 1,
          infinite: false,
          lazyLoad: 'ondemand',
          asNavFor: $mainSlider,
          autoplay: false,
          dots: false,
          arrows: false,
          centerMode: false,
          focusOnSelect: true,
      });

      // ðŸ”¹ Initialize Main Slider
      $mainSlider.slick({
          slidesToShow: 1,
          slidesToScroll: 1,
          infinite: false,
          arrows: true,
          autoplay: false,
          dots: false,
          lazyLoad: 'ondemand',
          autoplaySpeed: 3000,
          asNavFor: $thumbSlider,
          prevArrow:
          '<button type="button" class="slick-prev"><i class="fa fa-angle-left"></i></button>',
          nextArrow:
          '<button type="button" class="slick-next"><i class="fa fa-angle-right"></i></button>'
      });
  }
});

  // ðŸ”¹ Adjust equal heights between thumbnails and main section
    function adjustHeights() {
      $('.pt-img-main').each(function () {
        var $parent = $(this);
        var $thumbsColumn = $parent.find('.pt-thumbs-column-inner');
        var $adjustSizeElements = $parent.find('.pt-adjust-size');

        if ($thumbsColumn.length && $adjustSizeElements.length) {
          var thumbsHeight = $thumbsColumn.outerHeight();
          $adjustSizeElements.css('height', thumbsHeight + 'px');
      }
  });
  }

  // Run after slight delay to ensure slick is initialized
  setTimeout(adjustHeights, 600);

  // Recalculate height on window resize
  $(window).on('resize', function () {
      setTimeout(adjustHeights, 400);
  });

});